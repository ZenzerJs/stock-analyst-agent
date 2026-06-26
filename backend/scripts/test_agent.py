import os
import sys
import io

# Fix Windows console UTF-8 printing issues
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add the parent directory of 'backend' to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.agent import app
from langchain_core.messages import HumanMessage

def test_query(query: str):
    # Check for API key
    if not os.getenv("GROQ_API_KEY"):
        print("ERROR: GROQ_API_KEY environment variable is not set!")
        print("Please create a 'backend/.env' file with your API key:")
        print("GROQ_API_KEY=gsk_...")
        sys.exit(1)
        
    print(f"\nUser Query: '{query}'")
    print("-" * 50)
    
    # Initialize state
    inputs = {"messages": [HumanMessage(content=query)]}
    
    # Stream the graph execution
    print("Streaming agent steps:")
    for output in app.stream(inputs, stream_mode="updates"):
        for node_name, state_update in output.items():
            print(f"\n[Node: {node_name}]")
            
            # Print messages added in this update
            messages = state_update.get("messages", [])
            for msg in messages:
                # Determine sender/type
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for tc in msg.tool_calls:
                        print(f"Tool Call: {tc['name']}({tc['args']})")
                elif msg.__class__.__name__ == "ToolMessage":
                    print(f"Tool Output (first 300 chars):\n{str(msg.content)[:300]}...\n")
                elif msg.__class__.__name__ == "AIMessage":
                    print(f"Agent Response:\n{msg.content}")
                else:
                    print(f"Message ({msg.__class__.__name__}): {msg.content}")
    print("-" * 50)

if __name__ == "__main__":
    # Default query if none provided
    query = "How is AAPL's revenue trending?"
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
    test_query(query)
