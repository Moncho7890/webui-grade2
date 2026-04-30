let counter = 0;

function incrementCounter() {
    counter++;
    document.getElementById("counter").textContent = counter;
    
}

function decrementCounter() {
    counter--;
    document.getElementById("counter").textContent = counter;
    
}
function reset() {
    counter = 0;
    document.getElementById("counter").textContent = counter;
}

