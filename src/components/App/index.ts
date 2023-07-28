import store, { addListener, removeListener } from '../../store'
import EditPanel from '../EditPanel'
import type TipsDialog from '../TipsDialog'
import type WantedButton from '../WantedButton'
import WantedPoster, { WantedPosterAttribute } from '../WantedPoster'
import LaunchHandler from './launch-handler'
import cssContent from './style.css?inline'
import templateContent from './template.html?raw'

const TAG_NAME = 'app-container'

const template = document.createElement('template')
template.innerHTML = templateContent

class App extends HTMLElement {
  #editPanel: EditPanel
  #tipsDialog: TipsDialog
  #wantedPoster: WantedPoster
  #uploadInput: HTMLInputElement
  #editButton: WantedButton
  #importButton: WantedButton
  #exportButton: WantedButton
  #posterButton: WantedButton
  #tipsButton: HTMLButtonElement

  #startTime: number = 0
  #root: ShadowRoot
  #storeListener: Parameters<typeof addListener>[1]

  constructor() {
    super()

    // Create a shadow root
    const shadowRoot = this.attachShadow({ mode: 'open' })
    this.#root = shadowRoot

    const style = document.createElement('style')
    style.textContent = cssContent

    // attach the created elements to the shadow DOM
    shadowRoot.append(style, template.content.cloneNode(true))
    shadowRoot.addEventListener('WantedPosterLoaded', () => {
      this.#removeLoading()
    })

    const posterSlot =
      this.#root.querySelector<HTMLSlotElement>('slot[name=poster]')
    this.#wantedPoster = posterSlot?.assignedNodes()[0] as WantedPoster

    const editPanelSlot = this.#root.querySelector<HTMLSlotElement>(
      'slot[name=editPanel]'
    )
    this.#editPanel = editPanelSlot?.assignedNodes()[0] as EditPanel
    this.#tipsDialog = this.#root.querySelector<TipsDialog>('tips-dialog')!

    this.#uploadInput =
      this.#root.querySelector<HTMLInputElement>('#uploadInput')!
    this.#editButton = this.#root.querySelector<WantedButton>('#editButton')!
    this.#importButton =
      this.#root.querySelector<WantedButton>('#importButton')!
    this.#exportButton =
      this.#root.querySelector<WantedButton>('#exportButton')!
    this.#posterButton =
      this.#root.querySelector<WantedButton>('#posterButton')!
    this.#tipsButton =
      this.#root.querySelector<HTMLButtonElement>('#tipsButton')!

    this.#storeListener = (key, value) => {
      switch (key) {
        case 'photoUrl':
          this.#setWantedPosterAttributes({ 'photo-url': value.toString() })
          break
        case 'nameSpacing':
          this.#setWantedPosterAttributes({
            'name-spacing': value.toString()
          })
          break
        case 'bountySpacing':
          this.#setWantedPosterAttributes({
            'bounty-spacing': value.toString()
          })
          break
        case 'name':
        case 'bounty':
        case 'shadow':
        case 'filter':
          this.#setWantedPosterAttributes({ [key]: value.toString() })
      }
    }
  }

  #removeLoading() {
    const loadingOverlay =
      this.#root.querySelector<HTMLElement>('.loading-overlay')!

    let minLoadingTime = 1000
    let intervalId = setInterval(() => {
      const time = new Date().getTime()
      if (time - this.#startTime < minLoadingTime) {
        return
      }

      clearTimeout(intervalId)
      loadingOverlay.style.transition = 'opacity 1s'
      loadingOverlay.style.opacity = '0'

      setTimeout(() => loadingOverlay.remove(), 1000)
    }, 200)
  }

  #setWantedPosterAttributes(attributes: WantedPosterAttribute) {
    const keys = Object.keys(attributes) as Array<keyof WantedPosterAttribute>
    for (let key of keys) {
      const value = attributes[key] ?? ''
      this.#wantedPoster.setAttribute(key, value)
    }
  }

  connectedCallback() {
    this.#startTime = new Date().getTime()

    this.#setWantedPosterAttributes({
      'name-spacing': store.nameSpacing.toString(),
      'bounty-spacing': store.bountySpacing.toString(),
      shadow: store.shadow.toString(),
      filter: store.filter
    })

    addListener('photoUrl', this.#storeListener)
    addListener('name', this.#storeListener)
    addListener('bounty', this.#storeListener)
    addListener('nameSpacing', this.#storeListener)
    addListener('bountySpacing', this.#storeListener)
    addListener('shadow', this.#storeListener)
    addListener('filter', this.#storeListener)

    this.addEventListener('dragover', (event) => {
      // prevent default to allow drop
      event.preventDefault()
    })

    this.addEventListener('dragenter', () => {
      this.classList.add('dragin')
    })

    this.addEventListener('dragleave', (e) => {
      // The "dragleave" event will trigger whenever cursor cross over the child element
      // which is a web component, so we can not just remove "dragin" style without any judgement.

      // For dragleave event, the "relatedTarget" property menas the element entered to.
      // So if "relatedTarget" is null, it will be the outside of window, which is the case
      // that we want to remove "dragin" style.
      if (e.relatedTarget === null) {
        this.classList.remove('dragin')
      }
    })

    this.addEventListener('drop', (event) => {
      // prevent default action (open as link for some elements)
      event.preventDefault()
      this.classList.remove('dragin')

      const file = event.dataTransfer?.files[0]
      if (!file || !file.type.startsWith('image')) {
        return
      }

      const objUrl = URL.createObjectURL(file)
      store.photoUrl = objUrl
    })

    this.#uploadInput.addEventListener('input', () => {
      const file = this.#uploadInput.files ? this.#uploadInput.files[0] : null
      if (!file || !file.type.startsWith('image')) {
        return
      }

      const objUrl = URL.createObjectURL(file)
      store.photoUrl = objUrl
    })

    this.#editButton.addEventListener('click', () => {
      this.#editPanel.toggle()
    })

    this.#importButton.addEventListener('click', () => {
      this.#uploadInput.value = ''
      this.#uploadInput.click()
    })

    this.#exportButton.addEventListener('click', async () => {
      if (this.#exportButton.loading) {
        return
      }

      this.#exportButton.loading = true
      try {
        await this.#wantedPoster.export()
      } catch (e) {
        console.error(e)
        let message = ''
        if (e instanceof Error) {
          message = e.message
        }
        // TODO show error in dialog instead of alert
        alert(`Oops! something went wrong. 😢 \n ${message}`)
      } finally {
        this.#exportButton.loading = false
      }
    })

    this.#posterButton.addEventListener('click', () => {
      this.#wantedPoster.changePoster()
    })

    this.#tipsButton.addEventListener('click', () => {
      this.#tipsDialog.toggle()
    })

    // set handler for launched file
    LaunchHandler.setConsumer(async (handles) => {
      const handle = handles[0]
      if (!LaunchHandler.isFileHandle(handle)) {
        return
      }
      const blob = await handle.getFile()
      const objUrl = URL.createObjectURL(blob)
      store.photoUrl = objUrl
    })
  }

  disconnectedCallback() {
    removeListener('photoUrl', this.#storeListener)
    removeListener('name', this.#storeListener)
    removeListener('bounty', this.#storeListener)
    removeListener('shadow', this.#storeListener)
    removeListener('filter', this.#storeListener)
  }
}

customElements.define(TAG_NAME, App)

export default App
