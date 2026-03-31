
    // Preloader
    window.addEventListener('load', function () {
      const preloader = document.getElementById('preloader');
      preloader.style.opacity = '0';
      setTimeout(() => {
        preloader.style.display = 'none';
      }, 500);
    });

    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenuClose = document.getElementById('mobile-menu-close');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');

    function openMobileMenu() {
      mobileMenu.classList.add('active');
      mobileMenuOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
      mobileMenu.classList.remove('active');
      mobileMenuOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    mobileMenuBtn.addEventListener('click', openMobileMenu);
    mobileMenuClose.addEventListener('click', closeMobileMenu);
    mobileMenuOverlay.addEventListener('click', closeMobileMenu);

    // Close mobile menu on link click
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });

    // Navbar Scroll Effect
    const navbar = document.getElementById('navbar');
    const navBg = document.getElementById('nav-bg');

    window.addEventListener('scroll', function () {
      if (window.scrollY > 50) {
        navBg.style.opacity = '1';
        navbar.classList.add('shadow-lg');
      } else {
        navBg.style.opacity = '0';
        navbar.classList.remove('shadow-lg');
      }
    });

    // Scroll Reveal Animation
    const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));

    // Counter Animation
    const counters = document.querySelectorAll('.counter');
    const counterSpeed = 200; // Lower is faster

    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const counter = entry.target;
          const target = parseInt(counter.getAttribute('data-target'));
          const updateCount = () => {
            const count = parseInt(counter.innerText);
            const increment = target / counterSpeed;
            if (count < target) {
              counter.innerText = Math.ceil(count + increment);
              setTimeout(updateCount, 1);
            } else {
              counter.innerText = target;
            }
          };
          updateCount();
          counterObserver.unobserve(counter);
        }
      });
    }, {
      threshold: 0.5
    });

    counters.forEach(counter => counterObserver.observe(counter));

    // Job Filter
    const filterBtns = document.querySelectorAll('.job-filter-btn');
    const jobCards = document.querySelectorAll('.job-card');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active button style
        filterBtns.forEach(b => {
          b.classList.remove('active', 'bg-primary-600', 'text-white');
          b.classList.add('bg-slate-100', 'text-slate-600');
        });
        btn.classList.add('active', 'bg-primary-600', 'text-white');
        btn.classList.remove('bg-slate-100', 'text-slate-600');

        // Filter cards
        const filter = btn.getAttribute('data-filter');
        jobCards.forEach(card => {
          const category = card.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            card.style.display = 'block';
            setTimeout(() => card.style.opacity = '1', 10);
          } else {
            card.style.opacity = '0';
            setTimeout(() => card.style.display = 'none', 300);
          }
        });
      });
    });

    // Initialize filter button styles
    filterBtns.forEach(btn => {
      if (btn.classList.contains('active')) {
        btn.classList.add('bg-primary-600', 'text-white');
      } else {
        btn.classList.add('bg-slate-100', 'text-slate-600');
      }
    });

    // Form Submission Handler
    const inquiryForm = document.getElementById('inquiry-form');
    const formStatus = document.getElementById('form-status');

    inquiryForm.addEventListener('submit', function (e) {
      e.preventDefault();

      // Simulate form submission
      const submitBtn = inquiryForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
      submitBtn.disabled = true;

      setTimeout(() => {
        // Show success message
        formStatus.classList.remove('hidden', 'text-red-500');
        formStatus.classList.add('text-green-600');
        formStatus.textContent = 'Thank you! Your inquiry has been submitted successfully. We will contact you soon.';

        // Reset form
        inquiryForm.reset();

        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        // Hide status after 5 seconds
        setTimeout(() => {
          formStatus.classList.add('hidden');
        }, 5000);
      }, 1500);
    });

    // Job Apply Button Handler
    const applyBtns = document.querySelectorAll('.job-apply-btn');
    applyBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        const card = this.closest('.job-card');
        const jobTitle = card.querySelector('h3').textContent;

        // Scroll to contact form
        document.getElementById('contact').scrollIntoView({
          behavior: 'smooth'
        });


        setTimeout(() => {
          const positionSelect = document.getElementById('position');
          for (let i = 0; i < positionSelect.options.length; i++) {
            if (positionSelect.options[i].text.includes(jobTitle.split(' ')[0])) {
              positionSelect.value = positionSelect.options[i].value;
              break;
            }
          }
        }, 800);
      });
    });

    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });