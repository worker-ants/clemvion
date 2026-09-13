# 요구사항(Requirement) 코드 리뷰

## 검토 범위

`error-code-emission-axis` 배치(라운드 3) — 가이드 식별자 가드에 **발행 축**을 추가하고
(`GUIDE_NON_EMITTED_VOCABULARY` + `collectQuotedLiterals`/`collectMessagePrefixes`/
`collectCatalogCodes`/`isMessagePrefixOnly`/공용 `collectMatches`), `logic{,.en}.mdx` 의
`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 서술을 "코드처럼" 읽히는 문장에서
"메시지 접두" 서술로 정정한다. 나머지 파일(`CHANGELOG.md`·`PROJECT.md`·plan·`review/**`)은
이 변경을 기록하는 문서 산출물이다.

핵심 구현 두 파일(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`)은
diff 가 프롬프트 예산으로 생략돼 `Read` 로 전체를 직접 열어 검토했다. 아래 핵심 주장은
소스를 직접 열어 재현했다(추정이 아니라 실측):

| 주장 | 실측 |
|---|---|
| `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 는 일반 `Error` 메시지 접두다 | `execution-engine.service.ts:7121,7125,7130` — `throw new Error(\`CONTAINER_*: …\`)`, 확인 |
| 구조화된 `error.code` 로 나가지 않는다 | `execution-engine.service.ts:8016` `nodeExec.error = { message }` — `code` 필드 없음. `NodeExecution.error` 타입도 `Record<string, unknown> \| null` (구조 강제 없음) — 확인 |
| `MAKESHOP_UNRESOLVED_PATH_PARAM` 도 동형 | `makeshop.handler.ts:436` 확인, 가이드 문장(`integrations.mdx:306`/`integrations.en.mdx:295`)도 "전용 코드 없음"으로 이미 정확 — 확인 |
| `MAX_ITERATIONS_EXCEEDED` 는 카탈로그가 아니라 소비자 Set 때문에 통과 | `loop-executor.ts:64,85` 접두 발행 + `execution-failure-classifier.ts:76` 소비자 Set 인용 — 확인 |
| 가드 스위트 GREEN | `guide-identifier-existence.test.ts` 직접 실행 → **68/68 통과** |

## 발견사항

- **[SPEC-DRIFT] (WARNING)** spec 6개 파일이 여전히 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 "코드"로 서술 — 이 배치가 정정한 가이드 문장과 정면으로 어긋난다
  - 위치: `spec/5-system/4-execution-engine.md` §3.0 (검증 규칙 표, "`CONTAINER_MISSING_EMIT` 에러로 실행 실패" 문구), `spec/3-workflow-editor/2-edge.md` §6.1 검증 행, `spec/3-workflow-editor/0-canvas.md` §11.2.2 제약 표, `spec/4-nodes/1-logic/0-common.md` 제약 절, `spec/4-nodes/1-logic/7-map.md` §6 "에러 코드" 표, `spec/4-nodes/1-logic/9-foreach.md` §6 "에러 코드" 표 — (line-level 위치는 이 diff 밖의 파일이라 게이트 숫자 없음. 직접 `Read`/`grep` 으로 확인)
  - 상세: 실측(`execution-engine.service.ts:7121·7125·7130`, `:8016`)으로 이 두 토큰은 `throw new Error()` 의 **메시지 접두**일 뿐이고 `nodeExec.error` 에 `code` 필드가 아예 없다. 반면 위 6개 spec 파일은 "…에러로 실행 실패"/"에러 코드" 표 열에 이 두 토큰을 올려 formal error code 처럼 서술한다 — 이 배치가 `logic{,.en}.mdx` 에서 고친 것과 정확히 같은 오류가 spec 본문에 남아 있다. 같은 저장소 안에 정답 선례(`spec/4-nodes/1-logic/3-loop.md:189-191`)가 이미 있다 — 거기는 **"메시지"** 열에 발행 문자열 전문을 인용해 정확하다.
  - **불일치 방향 판정**: 코드(엔진 동작 + 이번에 고친 가이드 문장)가 옳고, 위 6개 spec 파일이 낡았다 — 즉 순수 SPEC-DRIFT 다. 다만 이 배치 자체가 이 사실을 **이미 발견해 정확히 처분**했다 — `plan/in-progress/spec-draft-nullable-notation-followups.md:3419-3438`(이 diff 의 일부)에 6파일·근거·선례(`3-loop.md`)를 전부 적고 planner 몫으로 등재했으며, CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 경계를 정확히 지켰다(spec/ 직접 수정 안 함, `spec_impact: none` 도 이 diff 가 spec/ 를 건드리지 않았다는 사실과 일치).
  - 제안: 코드는 유지. spec 반영은 `project-planner` 가 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 체크리스트 항목(3419행)을 처리할 때 위 6개 위치를 `3-loop.md` §6 형식(발행 문자열 전문을 "메시지" 열에)으로 통일. 같은 파일 3440행의 `3-error-handling.md §1.4` "앵커 없는 코드" 카탈로그 표기 택일 항목도 이 항목과 연동돼 있으므로 함께 처분할 것 — 이 배치 스스로 그렇게 명시해 두었다.

- **[INFO]** `spec/conventions/user-guide-evidence.md` §2 가 "Build-time 가드 (3건)" 표에 `guide-identifier-existence.test.ts` 를 안 싣는다 — 이 diff 의 `PROJECT.md` 항목은 그 문서 §2 를 SoT 로 재인용한다
  - 위치: `spec/conventions/user-guide-evidence.md:68` (표 캡션 "3건"), 대조: `PROJECT.md`(이 diff, `guide-identifier-existence.test.ts` 행 말미) "SoT: `spec/conventions/user-guide-evidence.md §2`"
  - 상세: 이 SoT 포인터 자체는 이 diff 가 새로 만든 것이 아니라 `#1330` 때부터 있던 기존 서술이라(diff 의 `-`/`+` 양쪽 줄 모두에 같은 SoT 문구가 있다) 이 배치의 결함은 아니다. 다만 §2 표가 여전히 "3건"만 세고 있어, 이 문서만 읽으면 `guide-identifier-existence.test.ts`(그리고 `guide-sanitized-message-parity.test.ts` 등)의 존재를 알 수 없다.
  - 제안: 이 diff 의 범위 밖(개선 대상 파일이 아님). 참고용으로만 남긴다 — 다음에 이 가드 계열을 만지는 사람이 이 표를 SoT 로 오인해 "3건 뿐"이라고 판단하지 않도록.

- **[INFO]** `collectCatalogCodes` 의 spec 카탈로그 읽기가 `readIfPresent` 없이 하드 `fs.readFileSync` 다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (`catalogCodes` 선언부, `path.join(root, "spec/5-system/3-error-handling.md")`)
  - 상세: 이 파일이 이동/삭제되면 테스트가 특정 실패 메시지 없이 예외로 죽는다. 다만 이미 `review/code/2026/09/13/19_23_22/maintainability.md` INFO#1 이 "기존 관행 일치 — 조치 불요"로 처분한 사안이고, 같은 파일의 다른 하드 리드(`envExampleTexts` 는 `readIfPresent` 인데 spec 카탈로그는 아니다)와 성격이 다르다 — spec 카탈로그 파일 부재는 저장소 전체가 이미 깨진 상태를 뜻하므로 실용적으로 허용 가능한 판단으로 보인다. 조치 불요.

## 검증 (직접 수행)

- `codebase/frontend` 에서 `npx vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts` 직접 실행 → **68 passed (68)**, plan 이 기록한 라운드 2 종료 수치(63→68)와 일치.
- **독립 뮤테이션**: `GUIDE_NON_EMITTED_VOCABULARY` 에서 `CONTAINER_MULTIPLE_EMIT` 항목을 스크립트로 제거 → 베이스라인-0 테스트가 정확히 그 토큰 하나만 지목하며 **RED** (`expected [] received ['CONTAINER_MULTIPLE_EMIT']`). 원복 후 `md5` 로 원본과 바이트 동일함 확인, `git status --short` 로 이 세션의 리뷰 산출물 외 diff 없음 확인.
- `execution-engine.service.ts:7121,7125,7130,8016`, `makeshop.handler.ts:436`, `execution-failure-classifier.ts:76`, `loop-executor.ts:64,85` — plan/CHANGELOG/JSDoc 이 인용한 실측 줄 번호를 전부 직접 `Read` 로 대조, 전부 일치.
- 관련 spec 6개 파일(`4-execution-engine.md`, `2-edge.md`, `0-canvas.md`, `0-common.md`, `7-map.md`, `9-foreach.md`, `3-loop.md`) 및 `3-error-handling.md §1.4` 를 직접 열어 plan 이 적은 인용문·행 위치가 실재함을 확인.

## 요약

핵심 구현(발행 축 3종 수집기 + `isMessagePrefixOnly` 술어 + `GUIDE_NON_EMITTED_VOCABULARY` 등록 + 가이드 문장 정정)은 의도한 기능을 정확히 구현하며, 함수 시그니처·JSDoc·실제 동작이 (여러 라운드의 자기 반증을 거쳐) 지금은 일치한다. TODO/FIXME 없음, 반환값 누락 없음, 엣지 케이스(여닫이 따옴표 불일치·`:` 유무·워드 경계·다중 `where` 위치)가 합성 대조군으로 촘촘히 고정돼 있고, 직접 실행(68/68 GREEN)과 독립 뮤테이션(등록 제거 → RED)으로 검증된다. 유일한 실질 발견사항은 spec fidelity 축의 SPEC-DRIFT — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 을 "코드"로 서술하는 spec 6개 파일이 이번에 정정된 가이드 문장과 어긋난다 — 인데, 이 배치 스스로 그 사실을 실측하고 근거·선례·처분 옵션까지 적어 `project-planner` 몫으로 정확히 넘겨 두었으므로 이 diff 에 대한 조치 요구사항은 아니다(코드/가이드 변경 범위 안에서는 완결). 나머지는 이미 아는 관행(하드 파일 읽기)과 무관한 문서(§2 표 갱신 누락) 수준의 INFO 뿐이다.

## 위험도
LOW
