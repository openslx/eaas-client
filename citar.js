{
  let baseURL = document.currentScript?.src;
  baseURL = baseURL ? String(new URL(".", baseURL)) : "./";
  import(`${baseURL}webcomponent.js`);
}
