let resourceVersion
const app = App()

fetch('http://127.0.0.1:8001/api/v1/pods')
    .then((response) => response.json())
    .then((response) => {
        resourceVersion = response.metadata.resourceVersion
        const pods = response.items
        pods.forEach((pod) => {
            const podId = `${pod.metadata.name}-${pod.metadata.namespace}`
            console.log(podId)
            app.add(podId, pod)
        })
    })
    .then(()=>watcher())

function watcher() {
    fetch(`http://127.0.0.1:8001/api/v1/pods?watch=1&resourceVersion=${resourceVersion}`)
        .then((response) => {
            const stream = response.body.getReader()
            const textDecoder = new TextDecoder('utf-8')
            let data = ''

            return stream.read().then(function streamHandler({done, value}) {
                if (done) {
                    console.log("Get done")
                    return
                }
                data += textDecoder.decode(value)
                while (true) {
                    newLineIndex = data.indexOf('\n')
                    if (newLineIndex === -1) {
                        break
                    }

                    const newLine = data.slice(0, newLineIndex)
                    data = data.slice(newLineIndex + 1)

                    const event = JSON.parse(newLine)
                    console.log(event)
                    const pod = event.object
                    const podId = `${pod.metadata.name}-${pod.metadata.namespace}`
                    if (event.type === 'ADDED' || event.type === 'MODIFIED') {
                        app.add(podId, pod)
                    } else if (event.type === 'DELETED') {
                        app.delete(podId)
                    }
                }
                return stream.read().then(streamHandler)
            })
        })
}

function App() {
    const podArray = new Map()
    const content = document.querySelector('#container')


    function render() {
        const pods = Array.from(podArray.values())
        const nodesWithPods = groupByNode(pods)
        console.log(nodesWithPods)
        
        const nodes = Object.keys(nodesWithPods).map((node)=>{
            return [
                '<div class="node">',
                `<p>${node}</p>`,
                '<div class="pods">',
                `${renderPods(nodesWithPods[node])}`,
                '</div>',
                '</div>'
            ].join('')
        })

        function renderPods(podsOnNode) {
            return podsOnNode.map((item) =>
                [
                    `<div class="pod" data-tooltip="${item.name}"></div>`,
                ].join('')
            ).join('')
        }
        content.innerHTML = `${nodes.join('')}`
    }

    
    return {
        add(podId, pod) {
            podArray.set(podId, {
                name: pod.metadata.name,
                namespace: pod.metadata.namespace,
                node: pod.spec.nodeName,
            })
            render()
        },
        delete(podId) {
            podArray.delete(podId)
            render()
        }
    } 
}

function groupByNode(pods) {
    return pods.reduce((accumulator, currentValue) => {
        const key = currentValue.node
        if (!(key in accumulator)) {
            accumulator[key] = []
        }
        accumulator[key].push(currentValue)
        return accumulator
    }, {})
}