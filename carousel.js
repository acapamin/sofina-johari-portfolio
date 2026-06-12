class Carousel {
  constructor(name, trackSelector, prevBtnSelector, nextBtnSelector, indicatorsSelector) {
    this.name = name;
    this.track = document.querySelector(trackSelector);
    this.prevBtn = document.querySelector(prevBtnSelector);
    this.nextBtn = document.querySelector(nextBtnSelector);
    this.indicatorsContainer = document.querySelector(indicatorsSelector);

    if (!this.track || !this.prevBtn || !this.nextBtn || !this.indicatorsContainer) {
      console.error(`Carousel ${name} elements not found`);
      return;
    }

    this.slides = Array.from(this.track.querySelectorAll('.carousel__slide'));
    this.currentIndex = 0;
    this.isScrolling = false;
    this.scrollTimeout = null;

    this.init();
    this.setupEventListeners();
    this.observeSlideChanges();
  }

  init() {
    this.createIndicators();
    this.updateActiveIndicator();
  }

  createIndicators() {
    this.indicatorsContainer.innerHTML = '';
    this.slides.forEach((_, index) => {
      const indicator = document.createElement('button');
      indicator.className = 'carousel__indicator';
      indicator.setAttribute('aria-label', `Go to slide ${index + 1}`);
      indicator.addEventListener('click', () => this.scrollToSlide(index));
      this.indicatorsContainer.appendChild(indicator);
    });
  }

  updateActiveIndicator() {
    const indicators = this.indicatorsContainer.querySelectorAll('.carousel__indicator');
    indicators.forEach((indicator, index) => {
      indicator.classList.toggle('is-active', index === this.currentIndex);
    });
  }

  setupEventListeners() {
    this.prevBtn.addEventListener('click', () => this.prev());
    this.nextBtn.addEventListener('click', () => this.next());

    // Update current index when user manually scrolls
    this.track.addEventListener('scroll', () => this.onScroll());

    // Support keyboard navigation
    this.track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.next();
      }
    });
  }

  onScroll() {
    clearTimeout(this.scrollTimeout);
    this.isScrolling = true;

    this.scrollTimeout = setTimeout(() => {
      this.isScrolling = false;
      this.updateCurrentIndex();
    }, 100);
  }

  updateCurrentIndex() {
    const scrollLeft = this.track.scrollLeft;
    const slideWidth = this.slides[0]?.offsetWidth || 0;
    const gap = 24; // 1.5rem = 24px

    let closest = 0;
    let closestDistance = Infinity;

    this.slides.forEach((slide, index) => {
      const slidePosition = slide.offsetLeft;
      const distance = Math.abs(scrollLeft - slidePosition);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = index;
      }
    });

    this.currentIndex = closest;
    this.updateActiveIndicator();
  }

  scrollToSlide(index) {
    if (index < 0 || index >= this.slides.length) return;

    this.currentIndex = index;
    const slide = this.slides[index];

    // Calculate scroll position for left alignment
    const scrollLeft = slide.offsetLeft - this.track.parentElement.offsetLeft;

    this.track.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });

    this.updateActiveIndicator();
  }

  next() {
    const nextIndex = (this.currentIndex + 1) % this.slides.length;
    this.scrollToSlide(nextIndex);
  }

  prev() {
    const prevIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.scrollToSlide(prevIndex);
  }

  observeSlideChanges() {
    // Re-observe slides in case they change
    if (window.IntersectionObserver) {
      const options = {
        root: this.track,
        threshold: 0.5
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = this.slides.indexOf(entry.target);
            if (index !== -1 && !this.isScrolling) {
              this.currentIndex = index;
              this.updateActiveIndicator();
            }
          }
        });
      }, options);

      this.slides.forEach((slide) => observer.observe(slide));
    }
  }
}

// Initialize carousels when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Carousel('services', '#servicesTrack', '#servicesPrev', '#servicesNext', '#servicesIndicators');
  new Carousel('testimonials', '#testimonialsTrack', '#testimonialsPrev', '#testimonialsNext', '#testimonialsIndicators');
  new Carousel('videos', '#videosTrack', '#videosPrev', '#videosNext', '#videosIndicators');
});
