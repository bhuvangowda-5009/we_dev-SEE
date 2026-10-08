import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import '../css/dashboard.css'

function Chat() {
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadMessages()
  }, [])

  const loadMessages = () => {
    fetch('http://localhost:5000/api/messages')
      .then(response => response.json())
      .then(data => {
        setMessages(data)
      })
      .catch(error => {
        console.log('Error:', error)
      })
  }

  const sendMessage = (e) => {
    e.preventDefault()

    if (!message.trim()) {
      return
    }

    fetch('http://localhost:5000/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: 'Bhuvan',
        message: message
      })
    })
      .then(response => response.json())
      .then(data => {

        setMessages([
          ...messages,
          data
        ])

        setMessage('')
      })
      .catch(error => {
        console.log('Error:', error)
      })
  }

  return (
    <div className="dashboard">

      <Sidebar />

      <main className="dashboard-content">

        <header className="dashboard-header">

          <div>
            <h1>Messages</h1>

            <p>
              Communicate with your team.
            </p>
          </div>

        </header>


        <section className="dashboard-card">

          <div className="card-title">

            <h2>Team Chat</h2>

          </div>


          <div className="chat-messages">

            {messages.length === 0 ? (

              <p>
                No messages yet. Start the conversation!
              </p>

            ) : (

              messages.map(msg => (

                <div
                  className="task-item"
                  key={msg.id}
                >

                  <div>

                    <h3>
                      {msg.sender}
                    </h3>

                    <p>
                      {msg.message}
                    </p>

                  </div>

                </div>

              ))

            )}

          </div>


          <form onSubmit={sendMessage}>

            <input
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
            />

            <button
              className="create-button"
              type="submit"
            >
              Send
            </button>

          </form>

        </section>

      </main>

    </div>
  )
}

export default Chat