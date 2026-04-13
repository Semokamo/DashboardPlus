import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import {
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
  LIST_WIDTH,
  STATUS_WIDTH,
  STATUS_X,
} from './layout'
import { bridge, currentSection, resetTelegramState, state, type TelegramDialogKind } from './hub-state'
import { fetchTelegramDialogs, isTelegramLoggedIn } from '../_shared/telegram-auth'

async function rebuildPage(config: {
  containerTotalNum: number
  textObject?: TextContainerProperty[]
  listObject?: ListContainerProperty[]
}): Promise<void> {
  if (!bridge) return

  if (!state.startupRendered) {
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    state.startupRendered = true
    return
  }

  await bridge.rebuildPageContainer(new RebuildPageContainer(config))
}

function previewText(): string {
  const selected = currentSection()
  if (!selected) return 'Loading hub...'
  return selected.preview
}

export async function updatePreview(): Promise<void> {
  if (!bridge) return

  await bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 2,
    containerName: 'preview',
    contentOffset: 0,
    contentLength: 2000,
    content: previewText(),
  }))
}

function dashboardText(): string {
  return previewText()
}

export async function showDashboard(): Promise<void> {
  state.screen = 'dashboard'
  resetTelegramState()

  if (state.sections.length === 0) {
    await showLoading('Loading hub...')
    return
  }

  const labels = state.sections.map((section) => section.name)

  await rebuildPage({
    containerTotalNum: 2,
    listObject: [
      new ListContainerProperty({
        containerID: 1,
        containerName: 'sections',
        xPosition: 0,
        yPosition: 0,
        width: LIST_WIDTH,
        height: DISPLAY_HEIGHT,
        borderWidth: 1,
        borderColor: 5,
        borderRdaius: 4,
        paddingLength: 4,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: labels.length,
          itemWidth: LIST_WIDTH - 10,
          isItemSelectBorderEn: 1,
          itemName: labels,
        }),
      }),
    ],
    textObject: [
      new TextContainerProperty({
        containerID: 2,
        containerName: 'preview',
        content: dashboardText(),
        xPosition: STATUS_X,
        yPosition: 0,
        width: STATUS_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 4,
      }),
    ],
  })

  appendEventLog(`Dashboard: selected ${labels[state.currentSectionIndex] ?? 'none'}`)
}

export async function showDetail(): Promise<void> {
  state.screen = 'detail'

  const selected = currentSection()
  if (!selected) {
    await showDashboard()
    return
  }

  if (selected.name === 'Telegram') {
    state.telegramView = 'root'
    state.telegramListKind = null
    state.telegramItems = []

    if (!isTelegramLoggedIn()) {
      await rebuildPage({
        containerTotalNum: 1,
        textObject: [
          new TextContainerProperty({
            containerID: 1,
            containerName: 'detail',
            content: 'Telegram\n\nPlease log in from the application.\n\nDouble-tap to go back.',
            xPosition: 0,
            yPosition: 0,
            width: DISPLAY_WIDTH,
            height: DISPLAY_HEIGHT,
            isEventCapture: 1,
            paddingLength: 4,
          }),
        ],
      })
    } else {
      await rebuildPage({
        containerTotalNum: 2,
        textObject: [
          new TextContainerProperty({
            containerID: 1,
            containerName: 'telegramHeader',
            content: 'Telegram',
            xPosition: 0,
            yPosition: 0,
            width: DISPLAY_WIDTH,
            height: 44,
            isEventCapture: 0,
            paddingLength: 4,
          }),
        ],
        listObject: [
          new ListContainerProperty({
            containerID: 2,
            containerName: 'telegramMenu',
            xPosition: 0,
            yPosition: 44,
            width: DISPLAY_WIDTH,
            height: DISPLAY_HEIGHT - 44,
            borderWidth: 1,
            borderColor: 5,
            borderRdaius: 4,
            paddingLength: 4,
            isEventCapture: 1,
            itemContainer: new ListItemContainerProperty({
              itemCount: 3,
              itemWidth: DISPLAY_WIDTH - 10,
              isItemSelectBorderEn: 1,
              itemName: ['Channels', 'Chats', 'Groups'],
            }),
          }),
        ],
      })
    }
  } else {
    await rebuildPage({
      containerTotalNum: 1,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'detail',
          content: `${selected.name}\n\n`,
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          isEventCapture: 1,
          paddingLength: 4,
        }),
      ],
    })
  }

  appendEventLog(`Detail: opened ${selected.name}`)
}

function telegramListTitle(kind: TelegramDialogKind): string {
  switch (kind) {
    case 'channels':
      return 'Channels'
    case 'chats':
      return 'Chats'
    case 'groups':
      return 'Groups'
  }
}

export async function showTelegramDialogList(kind: TelegramDialogKind): Promise<void> {
  state.screen = 'loading'
  await showLoading(`Telegram\n\nLoading ${telegramListTitle(kind)}...`)

  try {
    const items = await fetchTelegramDialogs(kind)
    const labels = items.map((item) => item.title).slice(0, 25)

    state.screen = 'detail'
    state.telegramView = 'list'
    state.telegramListKind = kind
    state.telegramItems = items

    await rebuildPage({
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'telegramHeader',
          content: `Telegram / ${telegramListTitle(kind)}`,
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_WIDTH,
          height: 44,
          isEventCapture: 0,
          paddingLength: 4,
        }),
      ],
      listObject: [
        new ListContainerProperty({
          containerID: 2,
          containerName: 'telegramItems',
          xPosition: 0,
          yPosition: 44,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT - 44,
          borderWidth: 1,
          borderColor: 5,
          borderRdaius: 4,
          paddingLength: 4,
          isEventCapture: 1,
          itemContainer: new ListItemContainerProperty({
            itemCount: Math.max(labels.length, 1),
            itemWidth: DISPLAY_WIDTH - 10,
            isItemSelectBorderEn: 1,
            itemName: labels.length > 0 ? labels : ['No conversations found'],
          }),
        }),
      ],
    })

    appendEventLog(`Telegram: loaded ${telegramListTitle(kind)} (${items.length})`)
  } catch (error) {
    state.screen = 'detail'
    state.telegramView = 'root'
    state.telegramListKind = null
    state.telegramItems = []

    await rebuildPage({
      containerTotalNum: 1,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'detail',
          content: `Telegram\n\nUnable to load ${telegramListTitle(kind)}.\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nDouble-tap to go back.`,
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          isEventCapture: 1,
          paddingLength: 4,
        }),
      ],
    })

    appendEventLog(`Telegram: failed to load ${telegramListTitle(kind)}`)
  }
}

export async function showLoading(message: string): Promise<void> {
  state.screen = 'loading'

  await rebuildPage({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'loading',
        content: message,
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 4,
      }),
    ],
  })
}
