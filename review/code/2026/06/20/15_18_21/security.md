# 보안(Security) 리뷰 결과

## 발견사항

### `package.json` — `jsonwebtoken` 정확 버전 고정

- **[WARNING]** `jsonwebtoken` 이 `"9.0.3"` (caret 없이) 정확 고정되어 있음
  - 위치: `codebase/backend/package.json` — `"jsonwebtoken": "9.0.3"`
  - 상세: caret(`^`) 없이 정확 고정된 경우, 이후 패치 버전에 보안 수정이 포함되어도 `pnpm update` / `npm update` 가 자동으로 올리지 않는다. `jsonwebtoken` 은 과거 고심도 취약점(CVE-2022-23529 등 알고리즘 혼동·검증 우회)이 보고된 이력이 있으며, 패치 버전 이동이 차단된 상태에서 신규 CVE가 발행되면 대응 시점이 지연될 수 있다. 이번 diff 범위 외 기존 설정이지만 본 PR에서 `package.json` 이 변경 대상에 포함되었으므로 주목한다.
  - 제안: 의도적 고정이라면 인라인 주석으로 근거를 명시할 것(`// pinned: 9.0.x API 호환성 — 업데이트 전 migration 필요`). 그렇지 않다면 `"^9.0.3"` 으로 패치 허용. 중장기적으로 `jsonwebtoken` 대신 적극 유지보수 중인 `jose` (RFC 준수 WebCrypto API 기반)로의 마이그레이션 검토를 권고한다.

### `eslint.config.mjs` — 타입 안전성 규칙 완화의 간접 보안 영향

- **[INFO]** `no-unsafe-*` 시리즈가 `'warn'` 으로 유지되고 있으며, `no-unnecessary-type-assertion` 추가도 `'warn'` 수준
  - 위치: `codebase/backend/eslint.config.mjs` — rules 블록 전체
  - 상세: `no-unsafe-argument`, `no-unsafe-assignment`, `no-unsafe-return`, `no-unsafe-member-access`, `no-unsafe-call` 이 모두 `warn` (차단 아님). 이들 규칙이 `error` 가 아닌 경우 타입 경계 혼동(`any` 전파)이 코드 리뷰 없이 통과될 수 있다. 보안 직접 취약점은 아니나, SQL / 표현식 인젝션 방어 레이어가 TypeScript 타입 시스템에 일부 의존하는 경우 `any` 전파가 방어를 우회하는 경로가 될 수 있다. `no-unnecessary-type-assertion` 을 `warn` 으로 가시화한 것은 긍정적이나 차단하지 않으므로 `as unknown as T` 패턴의 의도치 않은 타입 단언이 누적될 수 있다.
  - 제안: 현재 PR 범위(lint 게이트 전환) 목적상 즉각 `error` 승격은 과도하다. 중장기적으로 `no-unsafe-*` 를 `error` 로 단계적 승격하고, 보안 민감 모듈(인증·권한·암호화 관련 파일)에 대해서는 별도 `files` 블록으로 stricter 규칙을 적용하는 것을 권고한다.

### `plan-frontmatter.test.ts` — 경로 검증 로직

- **[INFO]** `path.sep` 을 사용한 크로스플랫폼 경로 검증
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` lines 406–408
  - 상세: `p.includes(`${path.sep}plan${path.sep}in-progress${path.sep}`)` 검증은 보안 취약점이 아니며, 경로 탐색 공격 방어 문맥도 아니다. 테스트 코드이므로 직접 위험 없음. 다만 이 테스트가 신뢰 경계에서의 파일 접근 여부를 검증하는 보안 단위 테스트로 오해될 경우를 위해 주석 명시 권고(선택).

### README.md — 환경 변수 노출 수준 점검

- **[INFO]** README 가 `ENCRYPTION_KEY`, `JWT_SECRET` 등 민감 환경 변수 목록을 명시하고 있음
  - 위치: `codebase/backend/README.md` — `## 환경 변수` 섹션
  - 상세: 변수 이름 열거 자체는 표준 관행이며, 실제 값은 없으므로 직접 노출이 아니다. `assertProductionConfig` 가 런타임에 약한 설정을 거부한다는 문서화는 보안 가이드로서 긍정적이다. 이번 diff 에서 이 섹션은 변경되지 않았으며 추가 조치 불필요.

---

## 요약

이번 변경셋은 ESLint 게이트를 report-only 로 전환하고 관련 문서·테스트를 보정하는 소범위 작업이다. 보안 관점에서 새로운 직접 취약점(인젝션, 인증 우회, 하드코딩 시크릿, 암호화 약점 등)은 도입되지 않았다. 가장 주목할 사항은 기존부터 존재하던 `jsonwebtoken 9.0.3` 정확 고정으로, 이번 PR 에서 `package.json` 이 변경 대상에 포함된 만큼 인라인 고정 근거 주석 또는 caret 허용 여부를 확인할 것을 권고한다. ESLint `no-unsafe-*` 규칙이 전량 warn 수준에 머무는 것은 타입 안전성 측면의 잠재 보안 위험이나, 이번 PR 목적과 직교하므로 별도 백로그로 처리한다.

---

## 위험도

LOW
