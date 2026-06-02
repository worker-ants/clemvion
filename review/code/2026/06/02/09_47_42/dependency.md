# 의존성(Dependency) 리뷰

## 발견사항

### 새 의존성

- **[INFO]** `marked@^18.0.4` 및 `dompurify@^3.4.7` 신규 추가
  - 위치: `codebase/channel-web-chat/package.json` `dependencies`
  - 상세: `channel-web-chat`은 임베드형 웹채팅 위젯으로 백엔드에서 sanitize되지 않은 template 출력을 클라이언트에서 렌더해야 하는 요구사항이 있다(`src/lib/safe-html.ts` 참조). `marked`는 Markdown → HTML 변환, `dompurify`는 XSS 제거 sanitize를 담당한다. 두 패키지 모두 그 목적에 업계 표준 선택이며 의존성 도입 근거가 타당하다.
  - 제안: 이상 없음.

- **[INFO]** `@types/dompurify@^3.0.5` devDependency 추가
  - 위치: `codebase/channel-web-chat/package.json` `devDependencies`
  - 상세: TypeScript 타입 정의 패키지. `dompurify` 런타임 패키지와 버전 계열(`^3.x`)이 일치한다. `@types/trusted-types`를 내부 의존성으로 가져오며, `dompurify` 자체도 `@types/trusted-types`를 `optionalDependencies`로 선언하고 있어 중복 설치 없이 공유 가능하다.
  - 제안: 이상 없음.

### 버전 고정

- **[WARNING]** `dompurify`와 `marked`가 caret(`^`) 범위 지정으로 정의되어 있음
  - 위치: `codebase/channel-web-chat/package.json` `dependencies` 섹션 (`"dompurify": "^3.4.7"`, `"marked": "^18.0.4"`)
  - 상세: channel-web-chat은 임베드 위젯으로 타 사이트에서 동작하며 XSS 방어가 핵심 보안 요구사항이다. caret 범위(`^`)는 minor/patch 자동 업그레이드를 허용하므로 향후 `npm install`에서 예기치 않은 버전이 설치될 수 있다. 반면 `package-lock.json`에는 실제 설치 버전(`3.4.7`, `18.0.4`)이 고정되어 있어 `npm ci` 환경(CI/CD)에서는 재현성이 보장된다.
  - 제안: `package.json`의 해당 항목을 exact 버전(`"dompurify": "3.4.7"`, `"marked": "18.0.4"`)으로 고정하면 의도치 않은 자동 업그레이드를 방지할 수 있다. 보안 패치 적용은 의도적 버전 업 PR로 추적하는 것이 더 안전하다.

### 라이선스

- **[INFO]** `dompurify`의 라이선스는 `(MPL-2.0 OR Apache-2.0)` 듀얼 라이선스
  - 위치: `node_modules/dompurify` 항목, `"license": "(MPL-2.0 OR Apache-2.0)"`
  - 상세: 프로젝트 라이선스 정보가 `codebase/channel-web-chat/package.json`에 `license` 필드로 명시되지 않았다. Apache-2.0 또는 MPL-2.0 중 선택 가능하다. 배포 형태(SaaS 위젯 임베드)에서 Apache-2.0 선택 시 통상적으로 문제없다. MPL-2.0은 수정한 MPL 파일을 공개해야 하나 dompurify를 수정 없이 사용하는 경우 해당되지 않는다.
  - 제안: 프로젝트 라이선스 정책을 명시화하고 dompurify를 Apache-2.0으로 사용한다는 점을 `LICENSE` 파일 또는 문서에 기록할 것을 권장한다.

- **[INFO]** `marked@18.0.4`의 라이선스는 MIT
  - 위치: `node_modules/marked` 항목, `"license": "MIT"`
  - 상세: MIT 라이선스는 상업적·임베드 사용 모두에 제약이 없다.
  - 제안: 이상 없음.

### 취약점

- **[INFO]** `marked` v18.0.4 및 `dompurify` v3.4.7 - 현재 알려진 주요 CVE 없음
  - 상세: marked의 과거 버전(0.x~7.x)에서 ReDoS 취약점이 다수 보고된 바 있으나, v18 계열은 현재(2026-06-02 기준) 중요 CVE가 보고되지 않은 최신 안정 버전이다. channel-web-chat에서 `marked.parse`의 출력을 반드시 `DOMPurify.sanitize`로 처리하고 있어 XSS 방어가 올바르게 계층화되어 있다(`src/lib/safe-html.ts:37-38`).
  - 제안: CI에 `npm audit`을 추가하여 향후 새 CVE를 자동 감지할 것을 권장한다.

### 불필요한 의존성

- **[INFO]** 두 의존성 모두 표준 라이브러리나 기존 의존성으로 대체 불가
  - 상세: Next.js/React 생태계에는 내장 Markdown 파서나 XSS sanitizer가 없다. `marked`는 경량 Markdown 파서로 번들 크기 대비 기능이 적합하다. `DOMPurify`는 브라우저 DOM API를 활용한 sanitizer로 서버사이드에서는 동작하지 않으나, `safe-html.ts`에서 `typeof window === "undefined"` 가드를 통해 SSR/정적 export 안전성을 명시적으로 처리하고 있다.
  - 제안: 이상 없음.

### 의존성 크기

- **[INFO]** `marked` 번들 기여분 약 23KB(gzip), `dompurify` 약 7KB(gzip)
  - 상세: 두 패키지 합산 약 30KB(gzip) 추가. 임베드 위젯의 특성상 번들 크기 민감도가 있으나, 보안(XSS) 및 기능(Markdown 렌더) 목적에 비해 합리적인 크기다. `marked@18`은 tree-shaking을 지원하므로 번들러 최적화 여지가 있다.
  - 제안: 번들 크기 제약이 엄격하다면 `marked` 대신 더 경량인 `micromark` 또는 `snarkdown` 도입을 검토할 수 있으나 현재 선택도 적절하다.

### 호환성

- **[WARNING]** `marked@18.0.4`는 `node >= 20` 요구하나 `package.json`에 `engines` 필드 없음
  - 위치: `node_modules/marked` 항목, `"engines": { "node": ">= 20" }`
  - 상세: 개발/CI 환경이 Node.js 20 이상인지 확인 필요. `channel-web-chat/package.json`에 `engines` 필드가 없어 암묵적으로 허용하고 있다. Next.js 16 계열도 Node 20+ 권장이므로 실질적 충돌 가능성은 낮다.
  - 제안: `package.json`에 `"engines": { "node": ">=20" }` 추가하여 Node 버전 요구사항을 명시할 것을 권장한다.

- **[INFO]** `dompurify@3.x`는 브라우저 DOM API 의존 — SSR 환경에서 동작 불가
  - 상세: `safe-html.ts:34`에서 `typeof window === "undefined"` 체크로 SSR/정적 export 환경에서 null 반환 폴백을 구현하고 있다. 정적 export(`output: export`) 구조와 올바르게 호환된다.
  - 제안: 이상 없음. 기존 가드가 충분하다.

### 내부 의존성

- **[INFO]** `safe-html.ts`가 `marked`와 `dompurify`를 단일 모듈에서 캡슐화
  - 위치: `codebase/channel-web-chat/src/lib/safe-html.ts`
  - 상세: `presentations.tsx`와 `presentations.test.tsx`에서 이 모듈을 참조한다. 외부 패키지 의존성이 `safe-html.ts` 단일 파일에 국소화되어 있어 향후 라이브러리 교체 시 변경 범위가 최소화된다. 올바른 내부 모듈 의존 설계다.
  - 제안: 이상 없음.

## 요약

이번 변경에서 신규 추가된 `marked@^18.0.4`와 `dompurify@^3.4.7`은 임베드 웹채팅 위젯의 template 출력(Markdown/HTML)을 XSS 안전하게 렌더하기 위한 명확한 요구사항에 기반한 타당한 선택이며, 라이선스(MIT/Apache-2.0 or MPL-2.0)·호환성(브라우저 환경 가드 존재)·내부 모듈 설계(`safe-html.ts` 캡슐화) 모두 양호하다. 개선 포인트로는 보안 의존성의 caret 버전 지정(`^`)으로 인한 의도치 않은 자동 업그레이드 가능성, `engines` 필드 부재로 암묵적인 Node.js 버전 요구사항, `dompurify` 듀얼 라이선스에 대한 공식 선택 미문서화 세 가지가 저위험 수준으로 남는다.

## 위험도

LOW
