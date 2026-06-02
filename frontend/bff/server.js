const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------------
// Extrai hostname, porta e protocolo de FASTAPI_URL uma única vez.
// FIX C3: Todas as chamadas http.request usam esses valores — sem hardcode.
// ---------------------------------------------------------------------------
const _fastapiParsed = new URL(FASTAPI_URL);
const FASTAPI_HOSTNAME = _fastapiParsed.hostname;
const FASTAPI_PORT = _fastapiParsed.port
    ? parseInt(_fastapiParsed.port, 10)
    : (_fastapiParsed.protocol === 'https:' ? 443 : 80);
const FASTAPI_PROTOCOL = _fastapiParsed.protocol === 'https:' ? https : http;

// ---------------------------------------------------------------------------
// FIX A7: CORS com whitelist explícita de origens.
// Configure CORS_ORIGIN=https://app.workmy.com em produção.
// ---------------------------------------------------------------------------
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS = CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);

app.use(cookieParser());
app.use(cors({
    origin: (origin, callback) => {
        // Permite requests sem Origin (ex: curl, Postman, SSR)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error(`Origem bloqueada pelo BFF CORS: ${origin}`));
    },
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ---------------------------------------------------------------------------
// FIX A8: Opções de cookie centralizadas — secure é dinâmico por ambiente.
// ---------------------------------------------------------------------------
const COOKIE_OPTS_ACCESS = {
    httpOnly: true,
    secure: IS_PRODUCTION,           // true em produção (HTTPS), false em dev
    sameSite: IS_PRODUCTION ? 'strict' : 'lax',
    maxAge: 60 * 60 * 1000,         // 1 hora (alinhado com ACCESS_TOKEN_EXPIRE_MINUTES no backend)
    path: '/'
};

const COOKIE_OPTS_REFRESH = {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    path: '/'
};

function logBffAction(layer, action, detail) {
    console.log(`\x1b[36m[BFF]\x1b[0m \x1b[32m${layer}\x1b[0m -> ${action} | \x1b[90m${detail}\x1b[0m`);
}

// ---------------------------------------------------------------------------
// Helper: faz uma chamada HTTP/HTTPS ao FastAPI e retorna Promise<{status, body}>
// FIX C3: Usa FASTAPI_HOSTNAME e FASTAPI_PORT extraídos de FASTAPI_URL.
// ---------------------------------------------------------------------------
function callFastApi(path, method, data = null, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const hasBody = data && Object.keys(data).length > 0;
        const postData = hasBody ? JSON.stringify(data) : '';
        
        const options = {
            hostname: FASTAPI_HOSTNAME,
            port: FASTAPI_PORT,
            path,
            method,
            headers: { ...extraHeaders }
        };

        if (hasBody) {
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = FASTAPI_PROTOCOL.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', (chunk) => body += chunk);
            apiRes.on('end', () => {
                try {
                    resolve({ status: apiRes.statusCode, body: JSON.parse(body) });
                } catch {
                    resolve({ status: apiRes.statusCode, body });
                }
            });
        });

        req.on('error', reject);
        if (hasBody) {
            req.write(postData);
        }
        req.end();
    });
}

// Helper para gravar par de cookies de sessão
function setSessionCookies(res, accessToken, refreshToken) {
    res.cookie('workmy_access', accessToken, COOKIE_OPTS_ACCESS);
    res.cookie('workmy_refresh', refreshToken, COOKIE_OPTS_REFRESH);
}

// Helper para limpar cookies de sessão
function clearSessionCookies(res) {
    res.clearCookie('workmy_access');
    res.clearCookie('workmy_refresh');
}

// ============================================================
// 1. ENDPOINT DE LOGIN (INTERCEPTADO)
// ============================================================
app.post('/api/auth/login', async (req, res) => {
    logBffAction('Auth Gateway', 'POST /api/auth/login', 'Iniciando autenticação...');

    try {
        const { status, body } = await callFastApi('/api/auth/login', 'POST', {
            email: req.body.username || req.body.email,
            password: req.body.password
        });

        if (status === 200) {
            const { access, refresh, user } = body;
            setSessionCookies(res, access, refresh);
            logBffAction('Auth Gateway', 'Cookies Set', `Sessão criada para ${user.username}`);
            // Retorna apenas dados públicos — tokens ficam nos cookies HTTP-Only
            return res.status(200).json({ user });
        }

        return res.status(status).json(body);
    } catch (err) {
        logBffAction('Auth Gateway', 'Connection Error', err.message);
        return res.status(502).json({ detail: 'Erro de conexão com o Core Service FastAPI.' });
    }
});

// ============================================================
// 2. ENDPOINT DE CADASTRO (INTERCEPTADO)
// ============================================================
app.post('/api/auth/register', async (req, res) => {
    logBffAction('Auth Gateway', 'POST /api/auth/register', 'Iniciando registro...');

    try {
        const { status, body } = await callFastApi('/api/auth/register', 'POST', req.body);

        if (status === 200) {
            const { access, refresh, user } = body;
            setSessionCookies(res, access, refresh);
            logBffAction('Auth Gateway', 'Register OK', `Novo usuário: ${user.username}`);
            return res.status(200).json({ user });
        }

        return res.status(status).json(body);
    } catch (err) {
        logBffAction('Auth Gateway', 'Connection Error', err.message);
        return res.status(502).json({ detail: 'Erro de conexão com o Core Service FastAPI.' });
    }
});

// ============================================================
// 3. ENDPOINT DE LOGOUT (INTERCEPTADO)
// FIX C5: Encaminha o access token ao FastAPI para revogar o JTI na blacklist.
// ============================================================
app.post('/api/auth/logout', async (req, res) => {
    logBffAction('Auth Gateway', 'POST /api/auth/logout', 'Encerrando sessão...');

    const accessToken = req.cookies.workmy_access;

    // Revoga o token na blacklist do FastAPI (best-effort)
    if (accessToken) {
        try {
            await callFastApi('/api/auth/logout', 'POST', {}, {
                Authorization: `Bearer ${accessToken}`
            });
            logBffAction('Auth Gateway', 'Token Revoked', 'JTI revogado na blacklist do FastAPI');
        } catch (err) {
            logBffAction('Auth Gateway', 'Revoke Warning', `Não foi possível revogar: ${err.message}`);
        }
    }

    clearSessionCookies(res);
    logBffAction('Auth Gateway', 'Logout Complete', 'Cookies limpos. Sessão destruída.');
    return res.status(200).json({ message: 'Sessão encerrada com sucesso.' });
});

// ============================================================
// 4. MIDDLEWARE DE SEGURANÇA — PROXY DE ROTAS DE NEGÓCIO /api/*
// Injeta Bearer JWT nos cookies antes de encaminhar ao FastAPI.
// Executa Silent Refresh automático se access expirou mas refresh é válido.
// ============================================================
app.use(async (req, res, next) => {
    // Só intercepta rotas que começam com /api
    if (!req.path.startsWith('/api')) {
        return next();
    }

    // Ignora rotas de autenticação locais do BFF e health checks públicos
    if (
        req.path.startsWith('/api/auth/login') ||
        req.path.startsWith('/api/auth/register') ||
        req.path.startsWith('/api/auth/logout') ||
        req.path.startsWith('/api/health/ping')
    ) {
        return next();
    }

    const accessToken = req.cookies.workmy_access;
    const refreshToken = req.cookies.workmy_refresh;

    // Sem nenhum cookie — bloqueia imediatamente
    if (!accessToken && !refreshToken) {
        logBffAction('Proxy Security', 'Access Denied', 'Nenhum cookie de sessão encontrado.');
        return res.status(401).json({ detail: 'Acesso negado. Por favor, faça login.' });
    }

    // Access expirou mas refresh ainda é válido — Silent Refresh automático
    if (!accessToken && refreshToken) {
        logBffAction('Proxy Security', 'Silent Refresh', 'Access Token expirou. Renovando...');

        try {
            const { status, body } = await callFastApi('/api/auth/refresh', 'POST', { refresh: refreshToken });

            if (status === 200) {
                const newAccess = body.access;
                res.cookie('workmy_access', newAccess, COOKIE_OPTS_ACCESS);
                req.headers['authorization'] = `Bearer ${newAccess}`;
                logBffAction('Proxy Security', 'Silent Refresh OK', 'Novo Access Token gerado.');
                return next();
            }

            // Refresh inválido — limpa cookies e força re-login
            logBffAction('Proxy Security', 'Refresh Failed', `FastAPI retornou ${status}`);
            clearSessionCookies(res);
            return res.status(401).json({ detail: 'Sessão expirada. Por favor, logue novamente.' });
        } catch (err) {
            logBffAction('Proxy Security', 'Refresh Error', err.message);
            clearSessionCookies(res);
            return res.status(502).json({ detail: 'Erro ao renovar sessão.' });
        }
    }

    // Fluxo normal — injeta o Bearer JWT no header antes de encaminhar
    logBffAction('Proxy Security', `${req.method} ${req.path}`, 'Injetando Bearer JWT');
    req.headers['authorization'] = `Bearer ${accessToken}`;
    next();
});

// ============================================================
// 5. PROXY PARA SSE (SERVER-SENT EVENTS)
// Usa http-proxy-middleware pois precisa manter o stream aberto
// ============================================================
const sseProxy = createProxyMiddleware('/api/events/stream', {
    target: FASTAPI_URL,
    changeOrigin: true,
    logger: console
});

app.use(sseProxy);

// ============================================================
// 6. PROXY GENÉRICO MANUAL (Para todas as outras rotas /api/*)
// Substitui o http-proxy-middleware para evitar travamentos com body-parser
// ============================================================
app.all('/api/*', async (req, res) => {
    console.log(`==> BFF MANUAL PROXY RECEBEU: ${req.method} ${req.originalUrl}`);
    // Rotas já tratadas antes (login, register, logout, sse)
    if (
        req.path.startsWith('/api/auth/login') ||
        req.path.startsWith('/api/auth/register') ||
        req.path.startsWith('/api/auth/logout') ||
        req.path.startsWith('/api/events/stream')
    ) {
        console.log(`==> BFF MANUAL PROXY IGNORANDO: ${req.originalUrl}`);
        return; // Já respondido pelos handlers acima
    }

    try {
        const urlPath = req.originalUrl;
        const method = req.method;
        const body = (method !== 'GET' && method !== 'HEAD') ? req.body : null;

        console.log(`==> BFF MANUAL PROXY ENVIANDO AO FASTAPI: ${method} ${urlPath} bodyKeys=${body ? Object.keys(body) : 'none'}`);

        // Limpa headers conflitantes
        const headersToForward = { ...req.headers };
        delete headersToForward.host;
        delete headersToForward['content-length'];

        const { status, body: responseBody } = await callFastApi(urlPath, method, body, headersToForward);
        
        console.log(`<== BFF MANUAL PROXY RECEBEU DO FASTAPI: ${status}`);
        return res.status(status).json(responseBody);
    } catch (err) {
        logBffAction('Manual Proxy', 'Error', err.message);
        return res.status(502).json({ detail: 'Erro de proxy interno.' });
    }
});

// ============================================================
// Startup
// ============================================================
app.listen(PORT, () => {
    console.log(`\n\x1b[36m==================================================\x1b[0m`);
    console.log(`\x1b[36m  WORKMY BFF PROXY GATEWAY\x1b[0m`);
    console.log(`\x1b[36m  Porta:    http://localhost:${PORT}\x1b[0m`);
    console.log(`\x1b[36m  FastAPI:  ${FASTAPI_URL}\x1b[0m`);
    console.log(`\x1b[36m  CORS:     ${ALLOWED_ORIGINS.join(', ')}\x1b[0m`);
    console.log(`\x1b[36m  Ambiente: ${IS_PRODUCTION ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}\x1b[0m`);
    console.log(`\x1b[36m==================================================\x1b[0m\n`);
});
