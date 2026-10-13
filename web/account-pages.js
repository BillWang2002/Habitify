import {inboxHtml} from './inbox.js';
import {feedbackHtml} from './feedback.js';
import {inventoryHtml} from './reward-inventory.js';
export function accountPagesHtml() {
 return inboxHtml()+feedbackHtml()+inventoryHtml();
}
