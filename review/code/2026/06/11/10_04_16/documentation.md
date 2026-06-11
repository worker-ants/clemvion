# Documentation Review

## 발견사항

### [INFO] production-guards.ts 모듈 독스트링 품질 우수
- 위치: `codebase/backend/src/common/config/production-guards.ts` 전체
- 상세: 파일 상단 모듈 JSDoc, 각 exported const(`INSECURE_JWT_SECRETS`, `KNOWN_EXAMPLE_ENCRYPTION_KEYS`)의 인라인 주석, `assertProductionConfig` 함수의 `@param` 태그가 모두 갖춰져 있다. 각 가드 분기마다 위반 이유와 참조 태그(`04 C-1`, `04 M-4`, `04 M-7`)도 인라인으로 명시되어 있어 이해와 추적이 용이하다.

### [INFO] production-guards.spec.ts 테스트 파일 문서화 충분
- 위치: `codebase/backend/src/common/config/production-guards.spec.ts` 상단 JSDoc
- 상세: 파일 상단에 테스트 목적·테스트 전략("순수 함수라 env 맵을 주입해 전 분기를 검증"), 참조 태그(refactor 04 C-1·M-4·M-7)가 명확히 기술되어 있다. 각 `describe`/`it` 블록이 태그(예: `04 C-1`, `04 M-4`, `04 M-7`)와 의도를 함께 설명하고 있어 가독성이 좋다.

### [INFO] .env.example 변경 주석이 의도와 일치
- 위치: `codebase/backend/.env.example` L197-202
- 상세: 변경된 `ENCRYPTION_KEY` 값(`0000...0000`)에 대해 "!! MUST regenerate", "Generate with: openssl rand -hex 32", "NODE_ENV=production refuses to boot if this placeholder is used" 경고와 `production-guards.ts` 참조가 명시되어 있다. 옛 예시 키(`0123456789abcdef...`)도 `KNOWN_EXAMPLE_ENCRYPTION_KEYS`에 포함해 이전 배포를 차단하는 의도가 코드와 주석 양쪽에 일관되게 표현되어 있다.

### [INFO] main.ts 인라인 주석이 이전 방식과 신규 방식의 차이를 명확히 설명
- 위치: `codebase/backend/src/main.ts` bootstrap 함수 초반
- 상세: 기존 두 개의 분산 인라인 guard 블록을 제거하고 `assertProductionConfig` 1회 호출로 통합한 변경에 대해 "refactor 04 C-1·M-4·M-7 + 기존 OAUTH/LLM stub" 태그 및 "비-production 은 no-op" 설명이 기술되어 있다. `ALLOW_PRIVATE_HOST_TARGETS` 의 warn 분리 이유도 인라인에서 spec 참조(`spec http-request §4`)와 함께 설명하여 왜 throw 가 아닌 warn 인지 명확하다.

### [WARNING] `isFlagOn` 내부 함수에 독스트링 누락
- 위치: `codebase/backend/src/common/config/production-guards.ts` L645-647(diff 기준)
- 상세: `isFlagOn`은 파일 내부(non-exported) 함수이지만, `'true'`와 `'1'` 두 값만 truthy로 취급하는 결정적 선택 이유(다른 truthy 표현 — `'yes'`, `'on'`, 대문자 등 — 을 의도적으로 제외함)를 설명하는 주석이 없다. 향후 기여자가 왜 `Boolean(value)` 나 `value !== 'false'` 를 쓰지 않는지 이해하기 어렵다.
- 제안: 함수 위에 한 줄 주석 추가 — 예: `// Only exact string 'true' or '1' are treated as on; any other value (including 'yes', 'on', uppercase) is treated as off.`

### [INFO] spec/5-system/1-auth.md JWT_SECRET fail-closed 노트 위치 적절
- 위치: `spec/5-system/1-auth.md` §2.1 (JWT 토큰 구조 표 직후)
- 상세: blockquote 형식으로 삽입된 `JWT_SECRET production fail-closed (refactor 04 C-1)` 노트가 실제 코드 파일(`production-guards.ts`, `main.ts`)과 참조 태그로 연결되어 있다. `INTERACTION_JWT_SECRET` 동형 패턴 언급도 spec 일관성 측면에서 유용하다.

### [INFO] spec/5-system/11-mcp-client.md MCP_ALLOW_INSECURE_URL fail-closed 문서화 적절
- 위치: `spec/5-system/11-mcp-client.md` §3.2 blockquote 끝부분
- 상세: 기존 "운영 환경에서 절대 활성화 금지" 설명 뒤에 "Production fail-closed 강제 (refactor 04 M-7)" 블록이 추가되었다. `ALLOW_PRIVATE_HOST_TARGETS` 와의 정책 분류 기준("절대 금지 → throw, 정당 용도 있음 → warn")이 명시되어 있어 미래 기여자가 두 플래그의 차이를 이해하기 좋다.

### [INFO] plan/complete/security-jwt-secret-fallback.md superseded 처리 문서화 적절
- 위치: `plan/complete/security-jwt-secret-fallback.md`
- 상세: frontmatter `status: superseded` 와 blockquote 형식의 SUPERSEDED 노트(날짜, 구현 PR 명, 구현 내용, 정제 결정 이유)가 모두 갖춰져 있다. 기존 조사 기록도 보존되어 이력 추적이 가능하다.

### [WARNING] `INTERACTION_JWT_SECRET` fail-closed 에 대한 spec 문서 연결 부재
- 위치: `production-guards.ts` 모듈 JSDoc, `spec/5-system/1-auth.md` §2.1 노트
- 상세: 두 위치 모두 `INTERACTION_JWT_SECRET` 의 fail-closed 와 "동형"이라고 언급하지만, 그 구현 위치(`interaction-token.service.ts`)나 관련 spec 섹션으로의 정확한 링크가 없다(`production-guards.ts` 의 JSDoc 에 파일 경로가 괄호 안에 있으나 spec 문서에는 링크가 없음). 동형 패턴이 여러 곳에 분산될수록 단일 진실 정책 추적이 어려워질 수 있다.
- 제안: `spec/5-system/1-auth.md` §2.1 노트에 "동형이다" 뒤에 `INTERACTION_JWT_SECRET` 의 fail-closed 가 정의된 spec 섹션(예: `spec/5-system/14-external-interaction-api.md §8.3`)으로의 링크를 추가하는 것을 고려한다.

### [INFO] CHANGELOG/DEPLOYMENT_NOTES 문서 없음 — 이 프로젝트에서는 plan 문서가 대체
- 위치: 프로젝트 전반
- 상세: 이 프로젝트는 CHANGELOG 파일 없이 `plan/complete/` 의 superseded/complete 문서가 변경 이력을 담당한다. `security-jwt-secret-fallback.md` 의 SUPERSEDED 노트가 그 역할을 충분히 수행하고 있다. 별도 CHANGELOG 업데이트 필요 없음.

---

## 요약

이번 변경(production fail-closed 가드 통합: `production-guards.ts` 신규 + `main.ts` 리팩터 + `.env.example` 경고 보강 + spec 두 곳 업데이트)은 문서화 품질이 전반적으로 높다. 모듈 JSDoc, 인라인 주석, spec 노트, plan superseded 처리가 모두 코드 변경과 일관되게 갱신되어 있으며 참조 태그(refactor 04 C-1·M-4·M-7)를 통한 추적 가능성도 확보되어 있다. 미비 사항은 두 가지 경미한 수준이다: `isFlagOn` 함수의 truthy 범위 결정 이유 주석 누락, 그리고 `INTERACTION_JWT_SECRET` 동형 패턴에 대한 spec 내 교차 링크 부재. 두 사항 모두 기능 동작이나 보안에는 영향이 없다.

## 위험도

LOW
