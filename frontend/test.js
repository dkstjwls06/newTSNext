const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const fs = require('fs');

const entry={};
const getEntry = (url)=>{
    // url: 'src' 기준의 상대경로(예: 'src', 'src/bb')
    const abs = path.resolve(__dirname, url);
    const dirents = fs.readdirSync(abs, { withFileTypes: true });

    dirents.forEach((dirent) => {
        const name = dirent.name;
        const relPath = path.posix.join(url.replace(/\\/g, '/'), name); // 엔트리용 POSIX 슬래시 유지
        if (dirent.isDirectory()) {
            getEntry(relPath);
        } 
        else if (dirent.isFile()){
            // .ts 파일이면서 .d.ts 파일이 아닌 경우에만 엔트리에 추가
            if(/\.ts$/.test(name) && !/\.d\.ts$/.test(name) ){
                const key = relPath.replace(/^src\//, '').replace(/\.ts$/, '');
                entry[key] = entry[key] || [];
                entry[key].push(`./${relPath}`);
            }
            if (/\.s?css$/.test(name)) {
                const key = relPath.replace(/^src\//, '').replace(/\.(s?css)$/, '');
                entry[key] = entry[key] || [];
                entry[key].push(`./${relPath}`);  
            }
        }
    });
}
getEntry('src');



// 모든 .html 파일을 HtmlWebpackPlugin으로 설정
const plugins=[];
const getHTML = (url)=>{
    const abs = path.resolve(__dirname, url);
    const dirents = fs.readdirSync(abs, { withFileTypes: true });

    dirents.forEach((dirent) => {
        const name = dirent.name;
        const relPath = path.posix.join(url.replace(/\\/g, '/'), name); // 엔트리용 POSIX 슬래시 유지
        if (dirent.isDirectory()) {
            getHTML(relPath);
        } else if (dirent.isFile() && /\.html$/.test(name)) {
            plugins.push(new HtmlWebpackPlugin({
                filename: name,
                template: `./${relPath}`,
                chunks: [relPath.replace(/^src\//, '').replace(/\.html$/, '')] // 해당 HTML에 대응하는 엔트리만 포함
            }));
        }
    });
}
getHTML('src');

console.log(entry);
console.log(plugins);