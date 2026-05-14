// ヘッダーをスクロールしたら背景色を変える
window.addEventListener("scroll", function() {
  var header = document.querySelector("header");

  if (window.scrollY > 50) {
    header.style.backgroundColor = "#000";
  } else {
    header.style.backgroundColor = "#1a1a1a";
  }
});