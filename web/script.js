const API_URL = 'http://localhost:3000';

async function createMatch() {
    const matchId = document.getElementById('createMatchId').value;
    const p1 = document.getElementById('player1').value;
    const p2 = document.getElementById('player2').value;
    const stake = document.getElementById('stake').value;
    const statusDiv = document.getElementById('status');

    statusDiv.innerText = 'Creating match...';

    try {
        const response = await fetch(`${API_URL}/match/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId, p1, p2, stake })
        });
        const data = await response.json();
        if (response.ok) {
            statusDiv.innerText = `Success: ${data.message}`;
        } else {
            statusDiv.innerText = `Error: ${data.error}`;
        }
    } catch (error) {
        statusDiv.innerText = `Network Error: ${error.message}`;
    }
}

async function submitResult() {
    const matchId = document.getElementById('resultMatchId').value;
    const winner = document.getElementById('winner').value;
    const statusDiv = document.getElementById('status');

    statusDiv.innerText = 'Submitting result...';

    try {
        const response = await fetch(`${API_URL}/match/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId, winner })
        });
        const data = await response.json();
        if (response.ok) {
            statusDiv.innerText = `Success: ${data.message}`;
        } else {
            statusDiv.innerText = `Error: ${data.error}`;
        }
    } catch (error) {
        statusDiv.innerText = `Network Error: ${error.message}`;
    }
}