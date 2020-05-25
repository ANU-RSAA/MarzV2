function isDetailed(props) {
    // Check if the current path is the detailed page
    if (window.marz_configuration.layout == 'MarzSpectrumView')
        return props.history.location.pathname.startsWith('/marz/detailed');
    return true;
}

function isOverview(props) {
    // Check if the current path is the overview page (TODO: Why is the "/marz" check needed on asvo.org.au?)
    return (props.location.pathname === '/marz/' || props.history.location.pathname.startsWith('/marz'));
}

function isSmall(props) {
    return isDetailed(props) && props.ui.sidebarSmall;
}

function getRemoteFile(url) {
    if (url) {
        let query_string = url.split('?');
        if (query_string.length>1) {
            let querys=query_string[1].split('&');
            for (let i=0;i<querys.length;i++) {
                if (querys[i].indexOf('=')==-1) {
                    return querys[i];
                }
            }
        }
    }
    return null;
}

function getLayoutStyle(url) {
    let query_string = url.split('?');
    if (query_string.length>1) {
        let querys=query_string[1].split('&');
        for (let i=0;i<querys.length;i++) {
            if (querys[i].indexOf('=')!=-1) {
                let keywords=querys[i].split('=');
                if (keywords[0]=='style') {
                    return keywords[1];
                }
            }
        }
        return "MarzSpectrumView";
    }
}

export {
    isDetailed,
    isOverview,
    isSmall,
    getRemoteFile,
    getLayoutStyle
}
