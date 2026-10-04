/* global SiteAnalytics */
const tracker = SiteAnalytics.createTracker({
  projectId: '22222222-2222-4222-8222-222222222222',
  collectionUrl: 'http://localhost:4102/v1/collect/22222222-2222-4222-8222-222222222222',
  pages: { '/': '/', '/gallery': '/gallery' },
  campaigns: { source: ['fixture'], medium: ['test'], campaign: ['day4'] },
});
const state = document.querySelector('#state');
document.querySelector('#allow').onclick = () => { tracker.start(); state.textContent = 'Analytics is on.'; };
document.querySelector('#deny').onclick = () => { tracker.stop(); state.textContent = 'Analytics is off.'; };
document.querySelector('#visit').onclick = () => { state.textContent = tracker.page() ? 'Visit queued.' : 'No visit recorded.'; };
document.querySelector('#send').onclick = async () => { state.textContent = await tracker.flush() ? 'Visits received.' : 'Nothing sent or collector unavailable. The page still works.'; };
let clicks = 0;
document.querySelector('#counter').onclick = (event) => { event.target.textContent = `Try the page: ${++clicks}`; };

document.querySelector('#spa').onclick = () => { history.pushState({}, '', '/gallery'); state.textContent = 'Gallery route opened.'; };
document.querySelector('#back').onclick = () => history.back();
