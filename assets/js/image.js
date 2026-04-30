let isCat = true;

function changePhoto() {
  const img = document.getElementById('photo');
  if (isCat) {
    img.src = "assets/images/dog.jpg";
  } else {
    img.src = "assets/images/cat.jpg";
  }
  isCat = !isCat;
}