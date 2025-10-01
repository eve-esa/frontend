
# Security Policy

> **About EVE**: EVE (Earth Virtual Expert) is an AI-powered Digital Assistant for Earth Observation and Earth Science, developed by Pi School in collaboration with Imperative Space and funded by ESA Φ-lab. This security policy covers the EVE Frontend application.

## Supported Versions

We actively support the following versions of EVE Frontend with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of EVE Frontend seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report a Security Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@philab.esa.int**

Include the following information in your report:

- **Type of issue** (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- **Full paths** of source file(s) related to the manifestation of the issue
- **Location** of the affected source code (tag/branch/commit or direct URL)
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact** of the issue, including how an attacker might exploit it

This information will help us triage your report more quickly.

### Response Timeline

- **Initial Response**: We will acknowledge receipt of your vulnerability report within **48 hours**.
- **Status Update**: We will provide a detailed response within **7 days** indicating the next steps in handling your report.
- **Resolution Timeline**: We aim to resolve critical vulnerabilities within **30 days** and other vulnerabilities within **90 days**.

### Disclosure Policy

We follow the principle of **Responsible Disclosure**:

1. **Coordinated Disclosure**: We request that you give us reasonable time to investigate and mitigate an issue before making any information public.
2. **Public Disclosure**: Once a fix is available, we will coordinate with you on the timing of public disclosure.
3. **Credit**: We will acknowledge your contribution in our security advisories (unless you prefer to remain anonymous).

## Security Best Practices

### For Contributors

When contributing to EVE Frontend, please follow these security guidelines:

#### Frontend Security

- **Input Validation**: Validate all user inputs on both client and server sides
- **XSS Prevention**: 
  - Use React's built-in XSS protection
  - Sanitize user-generated content before rendering
  - Be cautious with `dangerouslySetInnerHTML`
- **Authentication**: Implement secure authentication flows
- **Authorization**: Verify user permissions for sensitive operations
- **HTTPS Only**: Ensure all communications use HTTPS in production
- **Content Security Policy (CSP)**: Implement and maintain CSP headers

#### Dependency Management

- **Regular Updates**: Keep dependencies updated to their latest secure versions
- **Vulnerability Scanning**: Use tools like `npm audit` or `yarn audit`
- **Minimal Dependencies**: Only include necessary dependencies
- **Trusted Sources**: Use packages from trusted maintainers

#### Environment Variables

- **Secrets Management**: Never commit secrets, API keys, or passwords
- **Environment Separation**: Use different configurations for development, staging, and production
- **Access Control**: Limit access to production environment variables

#### Code Review

- **Security Review**: Include security considerations in code reviews
- **Static Analysis**: Use linting tools that check for security issues
- **Dependency Review**: Review new dependencies for security implications

### For Users

#### Secure Deployment

- **HTTPS Configuration**: Deploy the application over HTTPS only
- **Security Headers**: Implement security headers:
  - `Strict-Transport-Security`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`

#### Environment Security

- **Secure Hosting**: Use reputable hosting providers with security certifications
- **Access Controls**: Implement proper access controls for your deployment environment
- **Monitoring**: Set up security monitoring and logging
- **Backup Security**: Ensure backups are encrypted and securely stored

## Known Security Considerations

### Frontend Vulnerabilities

1. **Cross-Site Scripting (XSS)**
   - Mitigation: React's built-in XSS protection, content sanitization
   
2. **Cross-Site Request Forgery (CSRF)**
   - Mitigation: CSRF tokens, SameSite cookies
   
3. **Sensitive Data Exposure**
   - Mitigation: Never store sensitive data in client-side storage
   
4. **Insecure Direct Object References**
   - Mitigation: Proper authorization checks on the backend

### Third-Party Dependencies

We regularly monitor our dependencies for known vulnerabilities using:
- GitHub Dependabot alerts
- `yarn audit` for npm package vulnerabilities
- Manual security reviews of critical dependencies

## Security Tools and Resources

### Automated Security Testing

- **ESLint Security Plugin**: For static code analysis
- **Dependency Scanning**: Automated vulnerability scanning for dependencies
- **SAST Tools**: Static Application Security Testing integration

### Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Best Practices](https://blog.logrocket.com/react-security-best-practices/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)

## Security Updates

Security updates will be communicated through:

1. **GitHub Security Advisories**: For public vulnerabilities
2. **Release Notes**: Security fixes will be clearly marked
3. **Email Notifications**: For critical security updates (if you're subscribed)

## Contact Information

For security-related questions or concerns:

- **Email**: security@philab.esa.int
- **ESA Φ-lab**: [https://philab.esa.int](https://philab.esa.int)
- **Response Time**: Within 48 hours during business days

---

**Thank you for helping keep EVE Frontend and our users safe!**
