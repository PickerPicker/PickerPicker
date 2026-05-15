import './index.css'

function App() {
  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <h1 className="card-title text-3xl font-bold text-primary">PickerPicker</h1>
          <p className="text-base-content/70">피커피커에 오신 걸 환영합니다</p>
          <div className="card-actions mt-4">
            <button className="btn btn-primary">시작하기</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
