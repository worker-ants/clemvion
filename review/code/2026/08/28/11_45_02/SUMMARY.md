# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 코드 변경 자체(eslint 9→10 상향 + `no-useless-assignment`/`preserve-caught-error` 대응)는 전수 확인 결과 안전하지만, `documentation` 리뷰어가 최상위 SoT 문서(`PROJECT.md`)의 자체 2-place 편집 계약 위반(CRITICAL)을 발견했다. `testing` 리뷰어의 WARNING 2건(강제분할·복호화 실패 분기 테스트 부재)도 함께 존재해 병합 전 조치가 필요하다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `PROJECT.md`가 자신이 명문화한 "이 개수는 `.github/dependabot.yml`의 `ignore` 블록 항목 수와 항상 같아야 한다(2-place 편집)" 규약을 스스로 어겼다. 이번 PR이 `eslint-plugin-unicorn`의 `ignore` 항목을 완전히 삭제해 ignore 블록이 2건→1건(`typescript`만 잔존)이 됐는데, `PROJECT.md`는 여전히 "현재 2건"이라 서술하고 `eslint-plugin-unicorn`이 "여전히 major auto-bump로부터 보호되고 있다"는 틀린 인상을 준다. 정확히 이 PR이 재발 방지 근거로 인용하는 `#1049`(값-주석 drift) 유형의 결함을 최상위 문서에 새로 만든 것. | `PROJECT.md:57` (카운트 서술), `PROJECT.md:59` (unicorn 근거 문단) — 대응 실제 변경은 `.github/dependabot.yml`의 `ignore:` 블록(unicorn 항목 삭제) | `PROJECT.md:57`을 "현재 `typescript` 1건"으로 정정하고, `:59`의 unicorn bullet은 삭제하거나 "2026-08-28 eslint 10 상향으로 전제 소멸, 재발 방지는 `eslint-unicorn-peer.spec.ts` 상시 가드 + CI `--strict-peer-dependencies`로 이관"이라는 역사적 각주로 격하 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | Testing | `chunkText`의 강제분할(force-split, 단일 문장이 `chunkSize` 초과) 분기를 실행하는 테스트가 전무하다. 이번 PR이 정확히 그 분기의 `no-useless-assignment` 데드스토어(`overlapBuffer = getOverlapText(...)`)를 제거했는데, 안전성 판단이 수동 코드 읽기에만 의존한다(제거 자체는 안전함을 확인했으나 회귀 안전망이 없음). | `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts`(`chunkText`, diff L79-80) / `text-chunker.spec.ts`(force-split 케이스 0건) | `chunkSize`보다 훨씬 긴 단일 문장을 입력해 강제분할 경로를 타는 테스트를 추가하고, 분할 후 overlap이 빈 문자열임을 단언 |
| 3 | Testing | `SecretResolverService.resolve()`의 복호화 실패 catch 분기가 테스트로 전혀 실행되지 않는다. 이 PR이 바로 이 분기에 `eslint-disable-next-line preserve-caught-error`를 추가하며 "cause를 달면 크립토 에러 상세가 노출된다(`#814` 근거)"는 보안 불변식을 주석으로만 명시했는데, 이를 잠그는 테스트가 없어 향후 disable 주석이 실수로 지워져도 아무 테스트도 실패하지 않는다. | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts`(`resolve()` catch, diff L85-95) / `secret-resolver.service.spec.ts`(decrypt 실패 케이스 0건) | 손상 ciphertext/mock으로 `resolve()`를 호출해 메시지가 `'Secret decryption failed'`이고 `err.cause`가 `undefined`임을 함께 단언하는 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 4 | Maintainability | `.github/dependabot.yml`에서 `eslint-plugin-unicorn` ignore 항목은 삭제됐지만, 그 사유를 설명하던 22줄짜리 주석 블록만 어떤 YAML 노드에도 붙지 않은 채 고아로 남음(YAML 문법 오류는 아님) | `.github/dependabot.yml:75-96` | 다음에 이 파일을 만질 때 블록 유효성 재확인·필요시 축약 |
| 5 | Maintainability | `eslint-disable-next-line preserve-caught-error`(사유 주석은 위에 있으나 인라인 `-- 사유` 없음)가 저장소 관행(`// eslint-disable-next-line no-console -- <사유>`)과 스타일 불일치 | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:94` | `-- <한 줄 요약>` 추가 또는 컨벤션 명문화 |
| 6 | Testing | `cause: err` 신설 계약(원본 에러가 cause로 보존됨) 자체를 검증하는 단언이 없음 — 기존 테스트는 `.message` 정규식만 확인 | `expression-resolver.service.ts:316-318`, `code.handler.ts:454` 및 대응 spec 파일 | `err.cause`가 원본 예외와 동일함을 단언하는 케이스 추가 |
| 7 | Testing | frontend/`channel-web-chat`의 "eslint 10 상향 차단(상류 peer 미지원)" 상태에 backend `eslint-unicorn-peer.spec.ts`와 대칭되는 자동 회귀 가드가 없음 — 조건 해제 여부를 사람이 다시 실측해야 앎 | `codebase/frontend/eslint.config.mjs` 헤더 주석 vs `eslint-unicorn-peer.spec.ts` | (선택) 세 플러그인의 peer 실측을 CI에서 관측/경고하는 가벼운 가드 고려 |
| 8 | Scope | plan 문서에 이번 PR 범위(§2) 밖의 신규 백로그 §3(`typeorm→ioredis` frozen lockfile 사각지대)이 함께 추가됨 — 코드 변경 아니고 조사 기록일 뿐 | `plan/in-progress/deps-peer-gating-and-eslint10.md` §3 | 조치 불요 — 병합 조율자는 §2 완료와 §3 신규 미해결을 구분해 인지 |
| 9 | Dependency | 모노레포 내 eslint 메이저 버전 분열(backend+packages는 10, frontend/channel-web-chat은 9)이 상류(`eslint-config-next` 하위 플러그인) 미지원으로 의도적 발생 — `--strict-peer-dependencies` 실측 근거·가드 갖춤 | `.github/dependabot.yml`, 각 `eslint.config.mjs` 헤더 | 조치 불요. 위 세 플러그인이 eslint 10을 지원하는 시점을 재확인하는 주기적 트리거가 있으면 좋음 |
| 10 | Dependency | `eslint-plugin-unicorn` 56→73 상향으로 20여 개의 신규 transitive devDependency 유입(전부 devDependency, MIT/BSD 계열, 런타임/번들 영향 없음) | `pnpm-lock.yaml` | 조치 불요 |
| 11 | Side Effect | `pnpm-lock.yaml`에 eslint/unicorn과 무관해 보이는 전이 의존성 미세 버전 이동 소수 존재(예: `browserslist` patch, `entities`의 `optional` 플래그 소실) — `pnpm install` 전체 재해석의 통상적 부산물 | `pnpm-lock.yaml` | 조치 불요 |
| 12 | Security/Side Effect | `ai-turn-executor.ts`의 `finalSystemPrompt` 재할당 2곳 제거(`no-useless-assignment` 대응) — 하류가 `messages`만 소비함을 확인해 현재는 안전하나, AI 노드의 system prompt 조립이라는 민감 경로이므로 향후 리팩터 시 "messages 경로 하나로만 시스템 프롬프트가 전달된다"는 불변식이 깨지지 않도록 회귀 테스트로 고정 권장 | `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (single-turn/multi-turn 양쪽) | 캐너리 회귀 테스트 추가 고려 (필수는 아님) |
| 13 | User Guide Sync | `doc-sync-matrix.json`의 `new-node`/`node-schema-change`/`expression-language-change` glob이 5개 파일에 형식상 매칭되나, 실제 diff는 전부 lint-driven 기계적 수정(dead-store 제거, `cause` 추가, devDependency 버전 문자열)뿐이라 사용자 가시 계약(FieldTable·라벨·에러코드·표현식 의미) 변경이 없어 동반 갱신 누락 0건 | `codebase/backend/src/nodes/ai/**`(4개 파일), `codebase/packages/expression-engine/package.json` | 조치 불요 |
| 14 | Requirement | 이번 변경 영역(eslint 버전 정책/dependabot 정책)에 대응하는 `spec/` 문서가 없음 — 제품 요구사항이 아닌 인프라/툴체인 결정이라 SoT는 코드 주석(`eslint.config.mjs`)과 plan 문서로 명시적으로 지정됨 | `codebase/backend/eslint.config.mjs`, `codebase/frontend/eslint.config.mjs`, `plan/in-progress/deps-peer-gating-and-eslint10.md` | 조치 불요 (spec 커버리지 대상 아님) |

### 검증 확인된 항목 (문제 없음, 참고용)

- **`let x: T = <초기값>` → `let x: T`(dead-initializer 제거) 8개 파일**: `ssrf-safe-url.util.ts`, `form-mode.ts`, `execution-engine.service.ts`, `public-webhook-throttle.guard.ts`, `kb-tool-provider.ts`, `information-extractor.handler.ts`, `web-chat-sdk/src/index.ts`, `knowledge-base.service.ts`(dead-store 삭제). 6개 reviewer(security/requirement/scope/side_effect/maintainability/documentation)가 개별적으로 모든 catch 경로(조기 return/throw 또는 명시적 폴백 대입)를 추적 확인 — 실제 동작 변경 없음.
- **`preserve-caught-error` 대응 3곳**: `code.handler.ts`/`expression-resolver.service.ts`의 `cause: err` 추가는 다운스트림(`http-exception.filter.ts` 등) 어디서도 `.cause`를 직렬화하지 않아 정보노출(CWE-209) 위험 없음. `secret-resolver.service.ts`의 유일한 disable은 `#814` 선례(SS-SE-05, "서버 로그니까 안전"이 반증된 전례)와 정확히 부합하는 의도적 예외.
- **`parseGteFloor` 가드 확장**: `>=X`/`>=X.Y`/`>=X.Y.Z` 파싱 지원 확장 + fail-closed 유지 + discriminating fixture(`[10,9,1]` vs `[10,0,0]`) 포함 — 모범적 회귀 테스트로 평가됨.
- **실측 재현**: requirement 리뷰어가 `nest build`·`eslint --max-warnings 0`·대상 spec(30/30 pass)을 직접 재실행해 clean 확인. registry 실측값(`npm view`)도 주석·plan 서술과 전부 일치.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 인젝션/인증우회/시크릿노출 없음. `cause` 추가 2건 모두 미직렬화 확인 |
| requirement | NONE | plan §2 서술·registry 실측 전부 일치, build/lint/spec 재실행 clean |
| scope | LOW | 업무 로직 12곳 수정은 recommended 룰 대응으로 인한 의도된 범위 |
| side_effect | LOW | dependabot 자동화 동작 변경(unicorn ignore 해제)은 의도적, 가드 존재 확인 |
| maintainability | LOW | 고아 주석 블록, disable 주석 스타일 불일치(둘 다 INFO) |
| testing | MEDIUM | force-split·복호화 실패 분기 테스트 부재(WARNING 2건) |
| documentation | HIGH | `PROJECT.md` 2-place 편집 계약 위반(CRITICAL 1건) |
| dependency | NONE | 신규 프로덕션 의존성 없음, devDependency만 이동, peer 갈등 없음 |
| user_guide_sync | NONE | glob 매칭 5개 파일 전부 사용자 가시 계약 불변 확인 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 수준 관찰을 보고했다(위험도 NONE 판정 에이전트도 포함).

## 권장 조치사항

1. **[CRITICAL]** `PROJECT.md:57`의 dependabot ignore 카운트를 "1건"으로 정정하고 `:59`의 `eslint-plugin-unicorn` 근거 문단을 삭제하거나 역사적 각주로 격하한다 — 이 PR과 같은 커밋(또는 즉시 후속 커밋)에서 처리해 `#1049` 유형 재발을 막는다.
2. **[WARNING]** `text-chunker.spec.ts`에 강제분할(force-split) 경로 테스트를 추가한다.
3. **[WARNING]** `secret-resolver.service.spec.ts`에 복호화 실패 시 메시지·`cause` 부재를 함께 단언하는 테스트를 추가한다.
4. (선택) `expression-resolver.service.ts`/`code.handler.ts`의 `cause` 보존 계약과, frontend/channel-web-chat의 eslint 9 잔류 조건 해제 여부를 검증하는 경량 회귀/관측 테스트를 고려한다.
5. (선택) `.github/dependabot.yml`의 고아 주석 블록 정리 및 `eslint-disable-next-line` 인라인 사유 스타일 통일.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, dependency, user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` — 강제 대상 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(devDependency 상향 + 기계적 lint 수정)과 무관 |
  | architecture | 아키텍처 구조 변경 없음(router 판단) |
  | database | DB 스키마/쿼리 변경 없음(router 판단) |
  | concurrency | 동시성 로직 변경 없음(router 판단) |
  | api_contract | API 계약 변경 없음(router 판단) |