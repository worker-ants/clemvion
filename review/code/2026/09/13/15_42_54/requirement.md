# 요구사항(Requirement) 코드 리뷰 — guide-identifier-existence

## 검증 방법

본 changeset(44개 파일, `CHANGELOG.md`·`PROJECT.md`·`guide-error-code-*`(삭제)→`guide-identifier-*`(신규)·
`guide-sanitized-message-parity.test.ts`(주석 1줄)·`plan/**`·이전 3라운드 `review/code`·`review/consistency`
산출물)은 이미 `/ai-review` 3라운드(`14_41_14`→`15_03_06`→`15_24_12`, 매 라운드 뮤테이션 실측 동반) +
`--impl-done` 3라운드를 거쳐 수렴한 상태다. 프롬프트만으로는 핵심 파일(3~6번)의 diff 가 크기 제한으로
생략돼 있어, 저장소를 직접 `Read`/`grep`/vitest 실행으로 재검증했다(뮤테이션 없이 — 병렬 리뷰어 오염
방지 규약 준수, 저장소에 아무것도 쓰지 않음, `git status --short` 로 개시 전/후 상태 동일 확인).

- `guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`, `guide-sanitized-message-parity.test.ts`
  전문을 직접 열어 대조.
- `npx vitest run guide-identifier-existence.test.ts guide-sanitized-message-parity.test.ts` → **32/32 PASS**.
- `grep -rln "guide-error-code"` 전수 확인 — 남은 참조는 전부 (a) `review/**` 의 과거 라운드 서술(불변
  이력), (b) `guide-identifier-scan.ts`/`guide-sanitized-message-parity.test.ts`/`CHANGELOG.md` 안의
  **의도된 각주**("`#1330`/`#1331` 당시 이름")뿐 — 실질 죽은 참조(과거 라운드가 지적했던
  `guide-sanitized-message-parity.test.ts:16` 자매 참조)는 이미 고쳐져 있음을 실측 확인.
- `pnpm-lock.yaml`/`pnpm-workspace.yaml` 이 `composeTexts` 필터(`/^docker-compose.*\.ya?ml$/`)에서
  제외되는지 `ls`로 확인 — 과거 라운드 WARNING(락파일까지 스캔)이 실제로 좁혀졌음을 확인.
- `spec/conventions/user-guide-evidence.md` §2 를 직접 열어 "가드 3건"만 열거되고
  `guide-identifier-existence.test.ts`/`guide-sanitized-message-parity.test.ts` 가 없음을 재확인.
- `MESSAGE_CREATE`(외부 어휘 허용목록 유일 항목)가 backend/packages 소스에 없고 가이드에만 있음을
  grep 으로, `POSTGRES_PASSWORD`(compose 축 회귀 단언)가 실제 `docker-compose.yml` 들여쓴 줄에
  있음을 grep 으로, `MAKESHOP_UNRESOLVED_PATH_PARAM`(한계 서술의 실측 사례)가 소스·가이드 양쪽에
  실재함을 grep 으로 각각 재현.

## 발견사항

- **[WARNING] [SPEC-DRIFT]** `spec/conventions/user-guide-evidence.md §2` 가 이 가드 가족을 등재하지
  않았다 — 코드는 옳고 spec 갱신이 밀려 있다.
  - 위치: `spec/conventions/user-guide-evidence.md:68` (`## 2. Build-time 가드 (3건)` 표, 3행만 존재)
    vs `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:4` (`SoT: spec/conventions/user-guide-evidence.md` 자칭) 및 `PROJECT.md:300` (동일 SoT 인용).
  - 상세: `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`(신규, 이번 diff)와
    `guide-sanitized-message-parity.test.ts`(직전 PR 신규)가 스스로 이 spec 문서를 SoT 로 인용하는데,
    그 문서의 표·관계표(§2.1)는 여전히 "가드 3건"만 열거하고 두 가드를 담고 있지 않다. 이는 코드가
    틀린 게 아니라(요구사항·구현·테스트 모두 실측으로 일관되게 검증됨) spec 문서가 코드를 따라잡지
    못한 전형적 SPEC-DRIFT다. **이미 알려진 사실이다** — `plan/in-progress/guide-identifier-existence.md`
    §D 가 `--impl-prep`(3 checker 수렴) 단계에서 이 gap 을 인지했고, `plan/in-progress/spec-draft-nullable-notation-followups.md:3247` 에 planner 등재 항목(§2.1 관계표 2행 + frontmatter `code:` 3파일 누락 +
    Rationale 요구)으로 이미 실려 있다. `developer` 는 `spec/` 쓰기 권한이 없고 자기-반증형 소정정
    예외에도 해당하지 않아(그 예외는 *자신이 쓴 예고 문장*에만 열림, 여기는 spec 요구사항 표) 직접
    고칠 수 없는 것도 plan 이 정확히 밝히고 있다.
  - 제안: 코드 변경 불필요. `project-planner` 가 다음 spec 턴에서 `user-guide-evidence.md` §2 표를
    3건→5건으로, §2.1 관계표에 2행 추가, frontmatter `code:` 목록에 3파일(`guide-identifier-scan.ts`·
    `guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`) 추가, `## Rationale`
    에 "허용목록 없음" 원칙 번복 근거를 반영해야 한다 — 이미 plan 에 초안이 있으므로 그대로 반영.

## 그 외 점검 관점 — 결함 없음 확인

- **기능 완전성**: 트래커 항목이 요구한 "가이드가 적은 식별자(에러 코드+환경변수)가 backend/packages
  소스에 실재하는지" 를 3축(field-table/code-field/backtick) + env 선언처 병합 + 베이스라인 0 으로
  완전히 구현. 과거 결함(`MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL`)을 합성 fixture 로
  재현해 잡음을 직접 실행 확인(`vitest run` 32/32 PASS, 해당 `it("오기를 잡는다")` 포함).
- **엣지 케이스**: 빈 compose 배열, 소문자 토큰, 밑줄 없는 약어(`LLM`/`HTTP`), 여러 줄로 쪼갠
  FieldTable 행(의도적으로 놓치는 경계를 테스트로 고정), 주석 처리된 env 선언 등 경계값이 전부
  대조군 테스트로 커버됨.
- **TODO/FIXME/HACK/XXX**: 3개 변경 파일 전수 grep — 0건.
- **의도-구현 일치**: `scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`/
  `GUIDE_EXTERNAL_VOCABULARY` 이름과 동작이 정확히 일치. `composeTexts` 필터가 과거 라운드 지적대로
  `docker-compose*.ya?ml` 로 좁혀져 이름·주석이 약속한 범위와 실제 구현 범위가 이제 일치(직접 확인).
- **에러 시나리오**: `.env.example` 부재 시 `readIfPresent` 가 예외 대신 빈 배열을 반환해 정상
  degrade. 소스 파일은 `walkTree` 가 디스크에서 직접 나열하므로 존재하지 않는 경로를 읽는 경로 없음.
- **데이터 유효성**: `GUIDE_EXTERNAL_VOCABULARY` 각 항목의 `system`(>2자)·`why`(>20자) 최소 길이,
  상한(5건), "여전히 인용됨", "기준집합에 없음" 4가지가 전부 테스트로 강제(각 강제 항목이 실패하면
  RED 가 되는 구조를 코드로 확인).
- **비즈니스 로직**: "허용목록 없음" 원칙을 이번 축에서 포기한 결정과 그 대가(4강제)가 plan·코드
  주석·CHANGELOG 세 곳에서 일관되게 서술되고 실제 구현과 정확히 일치.
- **반환값**: `scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations` 모두 모든
  코드 경로에서 타입에 맞는 값을 반환(빈 배열/빈 Set 포함, undefined 반환 경로 없음).
- **존재 검사≠방출 검사 한계**: 트래커 원 요구사항이 명시한 스코프는 "실재하는지"(existence)이지
  방출(emission) 추적이 아니므로, 이 한계는 스코프 미달이 아니라 정확한 스코프 준수다. 방출 축
  갭(`MAKESHOP_UNRESOLVED_PATH_PARAM`)은 별도 트래커 항목(consistency naming_collision CRITICAL)으로
  이미 분리 등재돼 있어 이 PR 의 결함으로 재categorize 하지 않는다.

## 요약

`guide-error-code-existence` → `guide-identifier-existence` 로의 스코프 확장(에러 코드 전용 →
식별자 전반, 환경변수 축 신설)은 트래커가 요구한 기능을 완전히 구현하며, 이를 등재시킨 과거 결함
(`MCP_INSECURE_URL_ALLOWED` 오기)을 실제로 재현·검출함을 직접 실행으로 확인했다. 이전 3라운드
`/ai-review`가 잡았던 WARNING(자매 파일 stale 참조, compose 파일 과잉 스캔, UPPER_SNAKE 밑줄 요구
미검증, env 주석 분기 미검증)은 전부 저장소에서 실제로 고쳐져 있음을 직접 grep/실행으로 재검증했다.
유일한 잔여 항목은 `user-guide-evidence.md §2`가 이 가드 가족(및 자매 `guide-sanitized-message-parity`)을
아직 등재하지 않은 SPEC-DRIFT인데, 이는 코드의 결함이 아니라 spec 갱신 누락이며 이미
`plan/in-progress/spec-draft-nullable-notation-followups.md`에 상세 초안과 함께 planner 항목으로
등재돼 있어 이번 리뷰가 새로 요구할 조치는 없다. TODO/FIXME 없음, 모든 함수가 전 경로에서 적절한
값을 반환하며, 엣지 케이스·데이터 유효성·비즈니스 규칙이 정확히 반영돼 있다.

## 위험도

LOW
