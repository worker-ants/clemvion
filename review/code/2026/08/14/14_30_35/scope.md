### 발견사항

- **[INFO]** 이번 라운드의 실질 신규 델타는 커밋 `34e32e62f` 하나이고, 내용은 직전 consistency 라운드(`12_06_21`)가 낸 CRITICAL 1(REST `getStatus` 가 fanout 과 같은 `llmCalls` 를 strip 없이 반환)의 처방일 뿐 — 신규 스코프 이탈 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:349-355`(`stripExternalOnlyFields(deepRedactSecrets(...), MAX_REDACT_DEPTH)` 호출 추가), `codebase/backend/src/shared/utils/strip-external-only-fields.ts`(신규 파일, `websocket.service.ts` 에 있던 `stripDeep`/`stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS` 를 그대로 승격), `codebase/backend/src/modules/websocket/websocket.service.ts`(로컬 구현 제거 + import 로 교체, 두 호출부 모두 `MAX_SANITIZE_DEPTH` 명시 전달로 동작 동일하게 유지)
  - 상세: `git show 34e32e62f --stat` 로 대조한 결과, 코드 변경은 `interaction.service.ts`(+21/-9, import 2줄 + strip 호출 1곳 + 주석), `websocket.service.ts`(로직을 새 shared 파일로 옮기고 호출부만 남김, 순수 이동), 신규 `strip-external-only-fields.ts`(기존 `websocket.service.ts` 구현을 그대로 옮기되 `maxDepth` 를 파라미터화) 세 곳뿐이다. `deepRedactSecrets`/`MAX_REDACT_DEPTH` 자체는 이 diff 에서 손대지 않았다(`git diff origin/main...HEAD -- .../sanitize-error-message.ts` 결과 없음 — 기존에 이미 export 돼 있던 상수를 가져다 쓴 것뿐). 테스트도 `interaction.service.spec.ts` 에 신규 `it()` 1건만 순수 추가(기존 테스트 수정·삭제 없음). 공유 유틸로의 추출은 "같은 로직을 REST·WS 두 출구가 공유해야 한다"는 이번 결함의 근본 원인(한 출구만 막고 다른 출구를 세지 않음)을 구조적으로 막기 위한 최소 필요 조치이지, 불필요한 리팩토링이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `strip-external-only-fields.ts` 로의 추출은 로직을 옮긴 것뿐 — 새 동작·새 옵션·새 필드가 추가되지 않았다 (기능 확장 없음, 재확인)
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 전체(86줄) — `EXTERNAL_STRIPPED_FIELDS`(1개 값), `stripExternalOnlyFields(value, maxDepth)`, `stripDeep` 내부 재귀
  - 상세: 직전 세 라운드(`10_32_27`→`11_02_16`→`12_06_20`)가 `websocket.service.ts` 안에서 이미 검증한 `stripDeep` 구현(지연 clone-on-write, `__proto__` 오염 방지 스프레드, `MAX_SANITIZE_DEPTH` 캡, 경계 연산자 `>`)이 그대로 옮겨졌다. 유일한 실질 변경은 `maxDepth` 를 함수 시그니처 파라미터로 받게 한 것인데, 이는 REST(`MAX_REDACT_DEPTH`=10)와 WS fanout(`MAX_SANITIZE_DEPTH`=10)이 서로 다른 자매 sanitizer 의 상한을 호출부가 각자 명시하게 해 "두 상한이 조용히 갈라지는 것"(이 프로젝트가 반복 지적해 온 결함 클래스)을 막기 위한 것으로, JSDoc 에도 그 이유가 명시돼 있다. `EXTERNAL_STRIPPED_FIELDS` export 는 테스트 파일(`websocket.service.spec.ts`)에서만 참조되고 신규 소비자가 추가되지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 브랜치/정본 plan 제목("종결 payload 정리", `plan/in-progress/eia-terminal-payload.md`)과 실제 랜딩 코드(보안 누출 수정)의 표면적 불일치 — 이전 두 라운드에서 이미 확인·용인된 상태이며 이번 라운드에서 상태 변화 없음
  - 위치: `plan/in-progress/eia-terminal-payload.md`(`## 🚫 구현 차단 — --impl-prep BLOCK: YES` 유지, 이번 diff 로 코드 변경 없음) ↔ `plan/in-progress/spec-draft-eia-62-waiting-payload.md`(`## 🔴 조사 중 발견` 절이 pivot 경위를 기록)
  - 상세: `eia-terminal-payload.md` 는 여전히 `BLOCK: YES` 상태로 코드 변경이 없고(`git diff origin/main...HEAD -- plan/in-progress/eia-terminal-payload.md` 확인, 신규 파일 그대로), 실제 코드 변경은 착수 전 재판정 중 발견된 별건 보안 결함(`llmCalls` 중첩/REST 누출)에 대한 것이다. 이 pivot 은 `spec-draft-eia-62-waiting-payload.md` 자체가 "이 draft 의 범위를 넘고 심각도가 높아 별건으로 분리한다"고 스스로 밝히고 있어 은폐된 스코프 이탈이 아니다. `10_32_27/scope.md`·`12_06_20/scope.md` 가 이미 같은 사실을 확인하고 INFO/조치 불요로 처리했으며, 이번 라운드 델타(`34e32e62f`)도 같은 성격(같은 보안 결함의 남은 출구)이라 재상승할 이유가 없다.
  - 제안: 조치 불요 — 참고 기록.

- **[INFO]** `review/code/2026/08/14/{10_32_27,11_02_16,12_06_20}/**`·`review/consistency/2026/08/14/{07_44_12,10_32_29,11_02_18,12_06_21}/**` 프로세스 산출물 동반 커밋 — 정식 워크플로, 이번 라운드도 재확인만
  - 위치: `git diff --stat origin/main...HEAD` 기준 전체 77개 변경 파일 중 실제 애플리케이션 코드는 6개(`CHANGELOG.md` 포함 시 7개)뿐이고 나머지는 이전 리뷰/consistency 라운드 산출물(전부 신규 파일, insert-only)이다
  - 상세: `CLAUDE.md` "정보 저장 위치" 표가 `review/code/**`·`review/consistency/**` 를 정식 커밋 대상으로 지정하고 있고, 프로젝트 메모리에도 "review/ 는 gitignored 아님" 이 명시돼 있다. `10_32_27/scope.md`·`12_06_20/scope.md` 두 라운드가 이미 이 패턴을 LOW/NONE 위험으로 확인했으며, 이번 라운드에서 새로 추가된 `12_06_21/**` 도 같은 성격(직전 consistency 결과물)이라 판단이 달라지지 않는다.
  - 제안: 조치 불요.

### 요약

이번 라운드(`14_30_35`)의 실질 신규 코드 델타는 커밋 `34e32e62f` 하나이며, 그 내용은 직전 consistency 라운드(`12_06_21`)가 지적한 CRITICAL(REST `getStatus` 가 fanout 과 같은 `llmCalls` 누출을 막지 못함)을 해소하기 위해 `websocket.service.ts` 안에 있던 검증된 strip 로직을 `shared/utils/strip-external-only-fields.ts` 로 승격하고 `interaction.service.ts` 호출부 1곳에 적용한 것이 전부다. 신규 기능 추가·무관한 리팩토링·포맷팅·임포트/설정 변경이 없고, 테스트도 기존 케이스 수정 없이 신규 1건만 순수 추가됐다. 공유 유틸 추출은 "같은 데이터에 출구가 둘 이상인데 한쪽만 막았다"는 이번 결함 클래스 자체를 구조적으로 막기 위한 필요 최소 조치이지 불필요한 리팩토링이 아니다. 브랜치/정본 plan 제목과 실제 랜딩 코드(보안 수정)의 표면적 불일치, 코드 대비 프로세스 산출물(`review/**`) 다수 커밋은 앞선 두 스코프 리뷰 라운드(`10_32_27`, `12_06_20`)에서 이미 LOW/NONE 위험으로 확인·승인된 프로젝트 관례이며 이번 라운드에서 상태 변화가 없다.

### 위험도

NONE
