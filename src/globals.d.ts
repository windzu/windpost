// esbuild 的 text loader 把 .css / .html 当字符串导入，告诉 TS 这个事实。
declare module "*.css" {
  const content: string;
  export default content;
}
declare module "*.html" {
  const content: string;
  export default content;
}
