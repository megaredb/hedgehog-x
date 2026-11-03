/**
 * Centralized dictionary of user-facing UI strings (Russian).
 */
export const strings = {
	common: {
		appName: 'HEDGEHOG.INC',
		appTagline: 'Аудиокниги онлайн',
		loading: 'Загрузка...',
		save: 'Сохранить',
		cancel: 'Отмена',
		delete: 'Удалить',
		edit: 'Редактировать',
		close: 'Закрыть',
		confirm: 'Подтвердить',
		back: 'Назад',
		actions: 'Действия',
		error: 'Ошибка',
		success: 'Успешно',
		empty: 'Нет данных',
		search: 'Поиск...',
		notFound: 'Ничего не найдено',
		guest: 'Гость',
		signIn: 'Войти в аккаунт',
		signOut: 'Выйти'
	},
	nav: {
		library: 'Библиотека',
		info: 'Информация',
		catalog: 'Каталог',
		bookmarks: 'Закладки',
		history: 'История',
		downloads: 'Загрузки',
		community: 'Сообщество',
		support: 'Поддержать',
		about: 'О сайте',
		profile: 'Профиль',
		settings: 'Настройки',
		admin: 'Панель управления'
	},
	breadcrumbs: {
		home: 'Главная',
		books: 'Книги',
		bookmarks: 'Закладки',
		history: 'История',
		downloads: 'Загрузки',
		community: 'Сообщество',
		support: 'Поддержать',
		about: 'О проекте',
		profile: 'Профиль',
		settings: 'Настройки',
		admin: 'Панель управления',
		chapters: 'Главы',
		volumes: 'Тома',
		illustrations: 'Иллюстрации',
		auth: 'Авторизация'
	},
	player: {
		play: 'Воспроизвести',
		pause: 'Пауза',
		skipForward: 'Вперед на 10 сек',
		skipBack: 'Назад на 10 сек',
		speed: 'Скорость',
		volume: 'Громкость',
		sleepTimer: 'Таймер сна',
		undoSeek: 'Отменить',
		undoSeekTo: 'К',
		addBookmark: 'Добавить закладку',
		bookmarkSaved: 'Закладка сохранена',
		bookmarkNotePlaceholder: 'Заметка (необязательно)...',
		chapterFallback: 'Глава...',
		volumeFallback: 'Том...'
	},
	bookmarks: {
		title: 'Закладки',
		subtitle: 'Сохраненные фрагменты и заметки к аудиокнигам',
		emptyTitle: 'У вас пока нет закладок',
		emptyDescription:
			'Создавайте закладки во время прослушивания с помощью кнопки с иконкой закладки в плеере.',
		addModalTitle: 'Новая закладка',
		addModalDescription: 'Сохраните текущую позицию прослушивания с заметкой.',
		timeLabel: 'Таймкод',
		noteLabel: 'Заметка',
		saveBookmark: 'Сохранить закладку',
		deleteBookmark: 'Удалить закладку',
		deleteConfirmTitle: 'Удалить закладку?',
		deleteConfirmDescription:
			'Вы уверены, что хотите удалить эту закладку? Это действие необратимо.',
		jumpToBookmark: 'Перейти к фрагменту',
		noNote: 'Без заметки'
	},
	history: {
		title: 'История прослушиваний',
		subtitle: 'Недавно прослушанные главы и ваш прогресс',
		emptyTitle: 'История прослушиваний пуста',
		emptyDescription: 'Начните слушать аудиокниги в каталоге, и они появятся здесь.',
		resume: 'Продолжить',
		completed: 'Прослушано',
		inProgress: 'В процессе',
		clearHistory: 'Очистить историю',
		clearConfirmTitle: 'Очистить историю?',
		clearConfirmDescription: 'Вы уверены, что хотите очистить всю локальную историю прослушиваний?',
		chaptersCount: 'глав',
		today: 'Сегодня',
		yesterday: 'Вчера'
	},
	volume: {
		chaptersTab: 'Главы',
		illustrationsTab: 'Иллюстрации',
		commentsTab: 'Обсуждение',
		volumeCompletedTitle: 'Том завершен',
		nextVolume: 'Следующий том',
		volumeFinishedHeading: 'Вы дослушали том!',
		nextVolumeDescription: (num: number) =>
			`Том ${num} подошел к концу. Продолжите историю в следующем томе!`,
		volumeFinishedAll: 'Этот том полностью озвучен и завершен. Спасибо за прослушивание!',
		volumeOngoing:
			'Все вышедшие главы этого тома прослушаны. Озвучка продолжается — ждите новых глав!',
		playNextVolume: 'Воспроизвести следующий том',
		volumeReleasedStatus: 'Том завершен',
		volumeReleasedStatusDesc: 'Все главы тома полностью выпущены.',
		volumeRecordingStatus: 'В процессе озвучки',
		volumeRecordingStatusDesc: 'Новые главы появятся по мере записи. Подпишитесь на уведомления!',
		noIllustrationsTitle: 'Иллюстраций пока нет',
		noIllustrationsDesc: 'Для этого тома ещё не добавлены официальные иллюстрации.',
		zoomImage: 'Увеличить',
		discussionTitle: 'Обсуждение тома',
		discussionSubtitle: (num: number, title: string) =>
			`Комментарии последней выпущенной главы (${num}: ${title})`
	},
	support: {
		title: 'Поддержать автора',
		description:
			'Ваша поддержка помогает быстрее выпускать новые главы и озвучивать любимые книги.',
		cardTransferTitle: 'Перевод по карте',
		cardNumber: '4817 7603 3434 7832',
		copyCard: 'Скопировать номер карты',
		cardCopied: 'Номер скопирован!',
		bankQrTitle: 'Банковский перевод',
		bankQrSubtitle: 'Отсканируйте QR-код или нажмите на него',
		cryptoTitle: 'Криптовалюта (Сеть TON)',
		cryptoSubtitle: 'Отсканируйте QR-код или скопируйте адрес',
		cryptoAddress: 'UQDoqpcudSDCZGqKWCoLDT008_BNhSKBUao_G5MZR9jcpf-i',
		copyCrypto: 'Скопировать адрес',
		cryptoCopied: 'Адрес скопирован!'
	},
	community: {
		title: 'Сообщество',
		subtitle:
			'Хотите узнать больше об авторе? Подпишитесь на социальные сети и будьте в курсе всех новостей!',
		whyJoinTitle: 'Почему стоит подписаться?',
		notificationsTitle: 'Уведомления',
		notificationsDesc: 'Получайте уведомления о новых главах и обновлениях',
		chatTitle: 'Общение',
		chatDesc: 'Общайтесь с другими слушателями и делитесь мнениями',
		exclusivesTitle: 'Эксклюзивы',
		exclusivesDesc: 'Доступ к эксклюзивному контенту и бонусам'
	},
	admin: {
		title: 'Панель управления',
		books: 'Книги',
		volumes: 'Тома',
		chapters: 'Главы',
		illustrations: 'Иллюстрации',
		addBook: 'Добавить книгу',
		addVolume: 'Добавить том',
		addChapter: 'Добавить главу',
		addIllustration: 'Добавить иллюстрацию',
		deleteConfirm: 'Вы уверены, что хотите удалить эту запись?'
	}
} as const;

export default strings;
