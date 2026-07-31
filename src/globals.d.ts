// esbuild loader 把文本和示例图片作为模块导入，告诉 TS 这些事实。
declare module "*.css" {
  const content: string;
  export default content;
}
declare module "*.html" {
  const content: string;
  export default content;
}
declare module "*.md" {
  const content: string;
  export default content;
}
declare module "*.jpg" {
  const dataUrl: string;
  export default dataUrl;
}
