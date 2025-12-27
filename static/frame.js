const app = document.getElementById('app');

function loadingElement() {
    /*
    <div class="text-center">
        <div class="spinner-border" role="status">
            <span class="visually-hidden">加载中...</span>
        </div>
    </div>
    */


    const loadingElement = document.createElement('div');
    loadingElement.className = 'text-center';
    const ldinner = document.createElement('div');


    ldinner.className = 'spinner-border';
    ldinner.setAttribute('role', 'status');
    const srOnly = document.createElement('span');
    srOnly.className = 'visually-hidden';
    srOnly.textContent = '加载中...';
    ldinner.appendChild(srOnly);

    
    loadingElement.appendChild(ldinner);

    return loadingElement.outerHTML;
}


// 黑白主题切换
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    let newTheme;

    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon');
    
    if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'dark');
        newTheme = 'dark';
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        newTheme = 'light';
        if (themeIcon) themeIcon.textContent = '🌙';
    }
    localStorage.setItem('theme', newTheme);
}


function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon');

    const currentTheme = localStorage.getItem('theme') || 'dark';

    if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeIcon) themeIcon.textContent = '🌙';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeIcon) themeIcon.textContent = '☀️';
    }



    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function initTheme() {
    const currentTheme = localStorage.getItem('theme') || 'dark';

    if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

// 侧边栏加载完成后初始化主题
document.addEventListener('menuLoaded', initThemeToggle);

function jumpTo(url) {
    if (url.startsWith('/')) {
        if (url === '/') url = '/home';
        window.history.pushState({}, '', url);
        loadPage();
    } else {
        window.open(url, '_blank');
    }
}



/////////////

const loading = loadingElement();
let navHtml = ``;
let menuHtml = ``;

const defaultMethods = {
    toggleTheme: toggleTheme,
}

initTheme();


document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/') window.location.pathname = '/home';

    loadPage();

}, false);



async function loadScriptFromSrc(pageName){
    try {
        const pageModule = await import(`./js/${pageName}`);
        
        // 模块必须导出一个 init 函数！！！
        if (typeof pageModule.init === 'function') {
            pageModule.init();
        } else {
            console.warn(`页面 ${pageName} 缺少 init 函数`);
        }
        return pageModule.methods || {};
    } catch (error) {
        console.error(`加载页面 ${pageName} 失败:`, error);
        return {};
    }
}

function loadScript(scriptContent) {
    return new Promise((resolve, reject) => {

        const script = document.createElement('script');
        script.innerText = scriptContent;
        script.async = true;

        script.setAttribute('data-loaded-from', window.location.pathname);
        
        script.onload = () => resolve(script);
        script.onerror = () => reject(new Error(`Failed to load script: ${scriptContent}`));
        
        document.head.appendChild(script);
    });
}


function loadStyles(href) { 
    return new Promise((resolve, reject) => {
        // 防止重复加载相同 CSS
        if (document.querySelector(`link[href="${href}"]`)) {
            resolve();
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.type = 'text/css';
        link.onload = () => {
            resolve(link);
        };

        link.setAttribute('data-loaded-from', window.location.pathname);
        link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
        
        document.head.appendChild(link);
    });
}


async function clearOldPage(){
    window.__pageCleanup?.(); // 调用页面清理函数
    clearTimeout(window.__pageTimers); // 清除定时器
    
    document.querySelectorAll('link').forEach(link => {
        if (link.getAttribute('data-loaded-from') && link.getAttribute('data-loaded-from') !== window.location.pathname) {
            link.remove();
        }
    });

    document.querySelectorAll('script').forEach(script => {
        if (script.getAttribute('data-loaded-from') && script.getAttribute('data-loaded-from') !== window.location.pathname) {
            script.remove();
        }
    });
}

async function loadPage() {
    app.innerHTML = loading;
    const path = window.location.pathname;

    const cleanP = clearOldPage();

    try {


        const response = await fetch(`/api/pages${path}`, { method: 'POST' });
        const data = await processResponse(response);

        console.log(`${path} data:`, data);

        var methodsMap = defaultMethods;
        
        

        if (data.config.scripts) {
            // 等待所有异步加载完成 ！！！！！
            const methodsPromises = data.config.scripts.map(scriptSrc => loadScriptFromSrc(scriptSrc));

            const methodsArray = await Promise.all(methodsPromises);
            methodsArray.forEach(_methods => {
                Object.assign(methodsMap, _methods);
            });
        }


        await cleanP; // 等待清理完成


        if(data.htmlscripts) {
            loadScript(data.htmlscripts);
        }

        if(data.config.styles) {
            const stylesPromises = data.config.styles.map(cssFilename => loadStyles(`/css/${cssFilename}`));
            await Promise.all(stylesPromises);
        }

        //console.log('methodsMap:', methodsMap);


        //


       
        await loadNavigation(data.config);
        //

        renderPage(data.page, data.config, methodsMap=methodsMap);

        window.dispatchEvent(new Event('pageLoaded'));
    } catch (error) {
        
        console.error('加载页面失败:', error);
    }



}

function renderPage(pageHtml, config, methodsMap={}){
    app.innerHTML = pageHtml;

    if(config?.title) document.title = config.title;

    document.querySelectorAll('[data-on-click]').forEach(element => {
        const methodName = element.getAttribute('data-on-click'); // 获取方法名
        //console.log('methodName:', methodName);
        const handler = methodsMap[methodName];     // 从映射表获取对应函数

        if (typeof handler === 'function') {
            element.addEventListener('click', handler);
        } else {
            console.warn(`找不到方法: ${methodName}`, methodsMap);
        }
    });

    const as = document.querySelectorAll('a:not([data-bound])');
    as.forEach(a => {
        a.setAttribute('data-bound', 'true');
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const href = a.getAttribute('href');
            jumpTo(href);   
        });
    });
}


async function loadNavigation(config={}) {
    try {
        if(!navHtml){
            const navResponse = await fetch('/api/navigation', { method: 'POST' });
            const navData = await navResponse.json();
            navHtml = navData.data.nav
            menuHtml = navData.data.menu
        }


        document.getElementById('nav').innerHTML = renderTemplate(navHtml, config.nav || {});
        document.getElementById('menu').innerHTML = renderTemplate(menuHtml, config.menu || {});

        document.dispatchEvent(new Event('menuLoaded'));
    
    } catch (error) {
        console.error('加载导航栏失败:', error);
    }
}


function renderTemplate(content, data = {}) {
    // 处理条件占位符，如 {homeActive}...{/homeActive}
    content = content.replace(/\{([^}]+)\}([\s\S]*?)\{\/\1\}/g, (match, key, innerContent) => {
        // 如果数据中存在该键且值为真，则返回内部内容，否则返回空字符串
        return data[key] ? innerContent : '';
    });
    
    // 处理简单变量替换，如 {title}
    content = content.replace(/\{([^}]+)\}/g, (match, key) => {
        return data[key] !== undefined ? data[key] : '';
    });
    
    return content;
}

 async function processResponse(response) {
    const data = await response.json();
    if (!data.success) {
        console.error('API返回错误:', data.error || '未知错误');
        if (data.data?.page) {
            return data.data
        } else {
            return {'page': `<div class="alert alert-danger" role="alert">出现问题， 请稍后再试</div>`}
        }
    }
    return data.data;
};