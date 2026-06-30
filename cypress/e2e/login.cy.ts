describe('Auth: Login page', () => {
  it('loads the login page and shows inputs', () => {
    cy.visit('/auth/login')
    cy.get('input[name="email"]').should('exist')
    cy.get('input[name="password"]').should('exist')
    cy.contains('Continue with GitHub').should('exist')
  })
})
