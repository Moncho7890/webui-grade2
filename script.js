function reserve() {
    const name = document.getElementById('guestName').value;
    const count = document.getElementById('guestCount').value;


    const result= document.getElementById('reserveResult');
    result.textContent = `ご予約ありがとうございます！お名前: ${name}, 人数: ${count}名`;}