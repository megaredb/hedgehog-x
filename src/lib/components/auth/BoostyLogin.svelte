<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { Search, ChevronDown } from '@lucide/svelte';
	import {
		boostySendCode,
		boostyConfirmCode,
		boostyPhoneCodes,
		flagEmoji,
		type BoostyPhoneCode
	} from '$lib/client/boosty';

	interface Props {
		/** URL для редиректа после успешного входа/привязки. */
		callbackURL?: string;
	}

	let { callbackURL = '/' }: Props = $props();

	type Step = 'phone' | 'code' | 'busy' | 'error' | 'success';
	let step = $state<Step>('phone');
	let checking = $state(false);
	let nationalNumber = $state('');
	let code = $state('');
	let errorMessage = $state<string | null>(null);
	let deviceId = $state('');
	let verifyToken = $state('');
	let countdown = $state(0);
	let resendTimer: ReturnType<typeof setInterval> | undefined;

	// Страны из API Boosty + русские названия.
	let countries = $state<BoostyPhoneCode[]>([]);
	let countriesLoading = $state(true);
	let selectedCode = $state('RU');
	let countryOpen = $state(false);
	let countryQuery = $state('');
	let highlightedIndex = $state(-1);
	let countryListEl = $state<HTMLElement | null>(null);
	let codeInput = $state<HTMLInputElement | null>(null);

	const ruNames = new Intl.DisplayNames('ru', { type: 'region' });

	// Обогащаем страны русским названием, сортируем по нему.
	const enriched = $derived(
		countries
			.map((c) => ({ ...c, ruName: ruNameOf(c) }))
			.sort((a, b) => {
				if (a.code === 'RU') return -1;
				if (b.code === 'RU') return 1;
				return a.ruName.localeCompare(b.ruName, 'ru');
			})
	);

	function ruNameOf(c: BoostyPhoneCode): string {
		try {
			const n = ruNames.of(c.code);
			if (n && n !== c.code) return n;
		} catch {
			// ignore
		}
		return c.name;
	}

	const selectedCountry = $derived(
		enriched.find((c) => c.code === selectedCode) ?? enriched[0] ?? null
	);

	const filteredCountries = $derived.by(() => {
		const q = countryQuery.trim().toLowerCase();
		if (!q) return enriched;
		return enriched.filter(
			(c) =>
				c.ruName.toLowerCase().includes(q) ||
				c.name.toLowerCase().includes(q) ||
				c.dialCode.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
		);
	});

	function toggleCountryList() {
		countryQuery = '';
		countryOpen = !countryOpen;
		if (countryOpen) {
			const idx = selectedCountry ? filteredCountries.findIndex((c) => c.code === selectedCode) : 0;
			highlightedIndex = idx >= 0 ? idx : 0;
		} else {
			highlightedIndex = -1;
		}
	}

	function selectCountry(code: string) {
		selectedCode = code;
		countryOpen = false;
		highlightedIndex = -1;
	}

	function scrollHighlightedIntoView() {
		countryListEl
			?.querySelector<HTMLElement>(`[data-country-index="${highlightedIndex}"]`)
			?.scrollIntoView({ block: 'nearest' });
	}

	function handleCountryKeydown(e: KeyboardEvent) {
		if (!countryOpen || filteredCountries.length === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightedIndex = (highlightedIndex + 1) % filteredCountries.length;
			scrollHighlightedIntoView();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightedIndex =
				(highlightedIndex - 1 + filteredCountries.length) % filteredCountries.length;
			scrollHighlightedIntoView();
		} else if (e.key === 'Enter') {
			// Если фокус на option — нативный click кнопки сам выберет страну.
			if ((e.target as HTMLElement | null)?.getAttribute('role') === 'option') return;
			const c = filteredCountries[highlightedIndex];
			if (c) {
				e.preventDefault();
				selectCountry(c.code);
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			countryOpen = false;
			highlightedIndex = -1;
		}
	}

	async function loadCountries() {
		countriesLoading = true;
		try {
			const list = await boostyPhoneCodes();
			countries = list;
			selectedCode = list.some((c) => c.code === 'RU') ? 'RU' : (list[0]?.code ?? '');
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Не удалось загрузить коды стран';
		} finally {
			countriesLoading = false;
		}
	}

	function fullPhone(): string {
		const dial = selectedCountry?.dialCode ?? '+7';
		return dial + nationalNumber.replace(/[^0-9]/g, '');
	}

	function focusCodeInput() {
		requestAnimationFrame(() => codeInput?.focus());
	}

	async function sendCode() {
		const p = fullPhone();
		if (nationalNumber.replace(/\D/g, '').length < 6 || !/^\+?[0-9]{10,15}$/.test(p)) {
			errorMessage = 'Введите корректный номер телефона';
			return;
		}
		step = 'busy';
		errorMessage = null;
		try {
			const res = await boostySendCode(p);
			deviceId = res.deviceId;
			verifyToken = res.verifyToken;
			step = 'code';
			startCountdown(60);
			focusCodeInput();
		} catch (e) {
			step = 'error';
			errorMessage = e instanceof Error ? e.message : String(e);
		}
	}

	function startCountdown(seconds: number) {
		countdown = seconds;
		if (resendTimer) clearInterval(resendTimer);
		resendTimer = setInterval(() => {
			countdown -= 1;
			if (countdown <= 0 && resendTimer) clearInterval(resendTimer);
		}, 1000);
	}

	// Автоподтверждение: как только введено 6 цифр — сразу отправляем.
	async function onCodeInput() {
		if (code.length === 6 && !checking) {
			await confirm();
		}
	}

	async function confirm() {
		const c = code.trim();
		if (!/^\d{6}$/.test(c)) return;
		checking = true;
		errorMessage = null;
		try {
			await boostyConfirmCode({
				deviceId,
				verifyToken,
				smsCode: c,
				phone: fullPhone()
			});
			step = 'success';
			if (resendTimer) clearInterval(resendTimer);
			window.location.href = callbackURL;
		} catch (e) {
			// Неверный код: остаёмся на экране, поле чистим, подсвечиваем красным.
			errorMessage = e instanceof Error ? e.message : String(e);
			code = '';
			checking = false;
			focusCodeInput();
		}
	}

	function backToPhone() {
		step = 'phone';
		errorMessage = null;
		code = '';
	}

	onMount(() => {
		void loadCountries();
	});
</script>

<div class="flex w-full flex-col gap-3">
	{#if step === 'phone' || step === 'busy'}
		<div class="space-y-3">
			<span class="text-sm font-medium" id="boosty-country-label">Страна и номер телефона</span>

			{#if countriesLoading}
				<div class="flex h-10 items-center text-sm text-muted-foreground">
					Загружаем коды стран…
				</div>
			{:else}
				<!-- Кастомный select с поиском -->
				<div class="relative">
					<Button
						variant="outline"
						class="w-full h-11 justify-between px-3"
						type="button"
						disabled={step === 'busy'}
						aria-haspopup="listbox"
						aria-expanded={countryOpen}
						aria-label={selectedCountry
							? selectedCountry.dialCode + ' ' + selectedCountry.ruName
							: 'Выбор страны'}
						onclick={toggleCountryList}
						onkeydown={handleCountryKeydown}
					>
						<span class="flex min-w-0 items-center gap-2">
							{#if selectedCountry}
								<span class="text-lg leading-none">{flagEmoji(selectedCountry.code)}</span>
								<span class="font-medium">{selectedCountry.dialCode}</span>
								<span class="truncate text-muted-foreground">{selectedCountry.ruName}</span>
							{/if}
						</span>
						<ChevronDown class="size-4 shrink-0 text-muted-foreground" />
					</Button>

					{#if countryOpen}
						<div
							class="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg"
						>
							<div class="flex items-center gap-2 border-b border-border/60 px-3 py-2">
								<Search class="size-4 shrink-0 text-muted-foreground" />
								<input
									autocomplete="off"
									type="text"
									placeholder="Поиск страны…"
									value={countryQuery}
									oninput={(e) => {
										countryQuery = e.currentTarget.value;
										highlightedIndex = 0;
									}}
									onkeydown={handleCountryKeydown}
									class="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
								/>
							</div>
							<div
								class="max-h-56 overflow-y-auto py-1"
								role="listbox"
								tabindex="-1"
								bind:this={countryListEl}
								onkeydown={handleCountryKeydown}
							>
								{#if filteredCountries.length === 0}
									<div class="px-3 py-2 text-sm text-muted-foreground">Ничего не найдено</div>
								{:else}
									{#each filteredCountries as c, i (c.code + c.dialCode)}
										<button
											type="button"
											role="option"
											aria-selected={c.code === selectedCode}
											data-country-index={i}
											class={cn(
												buttonVariants({ variant: 'ghost' }),
												'w-full justify-start text-left px-3 py-1.5 text-sm h-auto',
												c.code === selectedCode && 'bg-muted/60',
												i === highlightedIndex && c.code !== selectedCode && 'bg-muted/40'
											)}
											onclick={() => selectCountry(c.code)}
										>
											<span class="text-lg leading-none">{flagEmoji(c.code)}</span>
											<span class="font-medium">{c.dialCode}</span>
											<span class="truncate">{c.ruName}</span>
										</button>
									{/each}
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<!-- Национальный номер -->
				<input
					id="boosty-phone"
					type="tel"
					placeholder={selectedCountry?.mask ? 'Номер (без кода)' : 'Номер без кода страны'}
					value={nationalNumber}
					oninput={(e) =>
						(nationalNumber = e.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 12))}
					disabled={step === 'busy'}
					class="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
				/>
			{/if}

			<p class="text-xs text-muted-foreground">
				Мы отправим SMS с кодом входа, как на сайте boosty.to. Пароль вводить не нужно.
			</p>

			{#if errorMessage}
				<p class="text-sm text-destructive">{errorMessage}</p>
			{/if}
			<Button class="w-full" disabled={step === 'busy' || countriesLoading} onclick={sendCode}>
				{step === 'busy' ? 'Отправляем код…' : 'Получить код'}
			</Button>
		</div>
	{:else if step === 'code'}
		<div class="space-y-3">
			<p class="text-sm text-muted-foreground">
				Код отправлен на&nbsp;<span class="font-medium text-foreground">{fullPhone()}</span>
			</p>
			<input
				bind:this={codeInput}
				type="text"
				inputmode="numeric"
				placeholder="Код из SMS"
				value={code}
				oninput={(e) => {
					code = e.currentTarget.value.replace(/\D/g, '').slice(0, 6);
					void onCodeInput();
				}}
				class="h-14 w-full rounded-md border bg-background text-center text-2xl tracking-[0.5em] outline-none transition-colors {errorMessage
					? 'border-destructive text-destructive'
					: 'border-input focus:border-ring'}"
			/>
			{#if errorMessage}
				<p class="text-center text-sm text-destructive">Код не подошёл. Попробуйте ещё раз.</p>
			{/if}
			<p class="text-center text-xs text-muted-foreground">
				{#if checking}
					Проверяем код…
				{:else}
					Подтверждение произойдёт автоматически после ввода 6 цифр.
				{/if}
			</p>
			<div class="flex items-center justify-between">
				<Button variant="ghost" size="sm" onclick={backToPhone}>← Сменить номер</Button>
				{#if countdown > 0}
					<span class="text-xs text-muted-foreground">Повторно через {countdown} с</span>
				{:else}
					<Button variant="outline" size="sm" onclick={sendCode}>Отправить код ещё раз</Button>
				{/if}
			</div>
		</div>
	{:else if step === 'success'}
		<div class="rounded-lg bg-green-500/10 p-3 text-center text-sm text-green-600">
			Вход выполнен — перенаправляем…
		</div>
	{:else}
		<div class="space-y-3">
			<p class="text-sm text-destructive">{errorMessage ?? 'Не удалось войти через Boosty'}</p>
			<Button variant="outline" class="w-full" onclick={backToPhone}>Попробовать снова</Button>
		</div>
	{/if}
</div>
