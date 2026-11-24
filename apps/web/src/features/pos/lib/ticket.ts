/** Route of the 80 mm ticket; auto=1 opens the print dialog on load. */
export const ticketUrl = (id: number, auto = true) => `/pos/ticket/${id}${auto ? '?auto=1' : ''}`
