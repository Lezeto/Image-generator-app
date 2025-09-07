import { useState } from "react";

function App() {
  const [data, setData] = useState(null);

  const callApi = async () => {
    try {
      const response = await fetch("/api/midjourney");
      const json = await response.json();
      setData(json.result);
    } catch (err) {
      console.error(err);
      setData("Error fetching data");
    }
  };

  return (
    <div>
      <h1>Midjourney API Test</h1>
      <button onClick={callApi}>Call API</button>
      {data && <pre>{data}</pre>}
    </div>
  );
}

export default App;
