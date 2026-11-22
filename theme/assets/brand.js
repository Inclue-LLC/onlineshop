/*
 * brand.js — キャラクターサイト共通スクリプト（3ストア共通）
 *  - <b-slider>        ヘッダー画像スライド
 *  - <b-store-filter>  店舗一覧のエリア絞り込み
 *  - [data-copy-url]   URL コピーボタン
 *  - POP UP の終了判定（ページキャッシュ対策。サーバー側の判定を補う）
 */
(() => {
  /* ---------- Slider ---------- */
  if (!customElements.get('b-slider')) {
    class BSlider extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('[data-slider-track]');
        this.slides = Array.from(this.track?.children || []);
        this.dots = Array.from(this.querySelectorAll('[data-slide-to]'));
        if (!this.track || this.slides.length < 2) return;

        this.index = 0;
        this.dots.forEach((dot) => dot.addEventListener('click', () => this.goTo(Number(dot.dataset.slideTo), true)));

        this.track.addEventListener(
          'scroll',
          () => {
            window.clearTimeout(this.scrollTimer);
            this.scrollTimer = window.setTimeout(() => this.syncIndex(), 80);
          },
          { passive: true }
        );

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (this.dataset.autoplay === 'true' && !reduceMotion && !window.Shopify?.designMode) {
          this.interval = Number(this.dataset.interval) || 5000;
          ['mouseenter', 'focusin', 'touchstart'].forEach((e) => this.addEventListener(e, () => this.stop(), { passive: true }));
          ['mouseleave', 'focusout'].forEach((e) => this.addEventListener(e, () => this.play()));
          document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.play()));
          this.play();
        }

        // テーマエディタでブロックを選択したらそのスライドへ
        document.addEventListener('shopify:block:select', (event) => {
          const i = this.slides.indexOf(event.target);
          if (i >= 0) this.goTo(i, true);
        });
      }

      disconnectedCallback() {
        this.stop();
      }

      goTo(i, user = false) {
        this.index = (i + this.slides.length) % this.slides.length;
        this.track.scrollTo({ left: this.slides[this.index].offsetLeft - this.track.offsetLeft, behavior: 'smooth' });
        this.updateDots();
        if (user) this.restart();
      }

      syncIndex() {
        const width = this.track.clientWidth || 1;
        this.index = Math.round(this.track.scrollLeft / width);
        this.updateDots();
      }

      updateDots() {
        this.dots.forEach((dot, i) => {
          dot.classList.toggle('is-active', i === this.index);
          dot.setAttribute('aria-current', i === this.index ? 'true' : 'false');
        });
      }

      play() {
        if (!this.interval) return;
        this.stop();
        this.timer = window.setInterval(() => this.goTo(this.index + 1), this.interval);
      }

      stop() {
        window.clearInterval(this.timer);
      }

      restart() {
        if (this.timer) this.play();
      }
    }
    customElements.define('b-slider', BSlider);
  }

  /* ---------- Store filter ---------- */
  if (!customElements.get('b-store-filter')) {
    class BStoreFilter extends HTMLElement {
      connectedCallback() {
        this.buttons = Array.from(this.querySelectorAll('[data-area-filter]'));
        this.cards = Array.from(this.querySelectorAll('.b-store-card'));
        this.count = this.querySelector('[data-store-count]');
        this.empty = this.querySelector('[data-store-empty]');
        if (!this.buttons.length) return;

        this.buttons.forEach((button) => button.addEventListener('click', () => this.apply(button.dataset.areaFilter)));
        const initial = new URLSearchParams(window.location.search).get('area') || '';
        this.apply(this.buttons.some((b) => b.dataset.areaFilter === initial) ? initial : '', false);
      }

      apply(area, updateUrl = true) {
        let visible = 0;
        this.cards.forEach((card) => {
          const show = !area || card.dataset.area === area;
          card.hidden = !show;
          if (show) visible += 1;
        });
        this.buttons.forEach((button) => {
          const active = button.dataset.areaFilter === area;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        if (this.count) this.count.textContent = String(visible);
        if (this.empty) this.empty.hidden = visible > 0;

        if (updateUrl) {
          const url = new URL(window.location.href);
          if (area) url.searchParams.set('area', area);
          else url.searchParams.delete('area');
          window.history.replaceState({}, '', url);
        }
      }
    }
    customElements.define('b-store-filter', BStoreFilter);
  }

  /* ---------- Copy URL ---------- */
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy-url]');
    if (!button) return;
    const url = button.dataset.copyUrl || window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      const input = document.createElement('textarea');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    const label = button.textContent;
    button.textContent = button.dataset.copiedLabel || 'コピーしました';
    window.setTimeout(() => (button.textContent = label), 2000);
  });

  /* ---------- POP UP の終了判定（キャッシュ対策） ---------- */
  const today = (() => {
    // 日本時間の日付（YYYY-MM-DD）
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  })();

  const refreshPopups = () => {
    // 個々の POP UP（カード・告知バー）
    document.querySelectorAll('[data-popup-end]').forEach((el) => {
      if (el.dataset.popupEnd && el.dataset.popupEnd < today) {
        el.hidden = true;
        el.style.display = 'none';
        return;
      }
      const status = el.querySelector('[data-popup-status]');
      if (status && el.dataset.popupStart && el.dataset.popupStart <= today && status.textContent.trim() !== '開催中') {
        status.textContent = '開催中';
        status.className = 'b-badge b-badge--live';
      }
    });

    // 中身が無くなった POP UP セクション
    document.querySelectorAll('[data-popup-container]').forEach((section) => {
      const items = section.querySelectorAll('[data-popup-end]');
      if (items.length && Array.from(items).every((el) => el.hidden)) section.style.display = 'none';
    });

    // 開催中・開催予定が 1 件も無ければ、POP UP リンク・告知バーなどをすべて隠す
    const json = document.getElementById('PopupRanges');
    if (!json) return;
    let ranges = [];
    try {
      ranges = JSON.parse(json.textContent || '[]');
    } catch (e) {
      return;
    }
    const hasActive = ranges.some((r) => (r.end || r.start) >= today);
    if (!hasActive) {
      document.querySelectorAll('[data-popup-only]').forEach((el) => (el.style.display = 'none'));
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshPopups);
  else refreshPopups();
  document.addEventListener('shopify:section:load', refreshPopups);
})();
