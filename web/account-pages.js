import {inboxHtml} from './inbox.js';
import {feedbackHtml} from './feedback.js';
export function accountPagesHtml() {
 return inboxHtml()+feedbackHtml();
}
