# 변경 범위(Scope) 리뷰 결과

## 검토 대상 (29개 파일, `git diff origin/main --stat` 과 payload 완전 일치 확인)
- 코드/plan (7): `execution-status-response.dto.ts`(+.spec) · `execution-status.literal.ts`(신규, +.spec 신규) · `interact-ack-response.dto.ts`(+.spec 신규) · `plan/in-progress/eia-context-schema-followups.md`
- 리뷰 산출물 (22): `review/code/2026/07/12/19_49_01/**`, `review/code/2026/07/12/20_08_27/**` (RESOLUTION/SUMMARY/각 reviewer md/meta.json/_retry_state.json)

## 컨텍스트 확인
`git diff origin/main --stat` 결과가 payload 의 29개 파일과 정확히 일치(추가 파일·drive-by 변경 없음, 29 files changed / +1271 −34).

plan 파일에 사전 등록된 백로그 항목("EIA 응답 DTO `status` 리터럴 유니온 SoT 통합", DTO 정규화 PR ai-review 14_52_32 maintainability WARNING 유래)을 이행한 뒤, 그 결과물에 대해 `/ai-review` 를 2라운드(19_49_01 → RESOLUTION → 20_08_27 fresh review → RESOLUTION) 수행한 전체 이력이 이번 diff 에 담겨 있다. `review/**` 는 CLAUDE.md 정보 저장 위치 표(`코드 리뷰 산출물 | review/code/<...>/`)상 정식 산출 경로이며, 프로젝트 관례상 SUMMARY·RESOLUTION 등은 gitignore 대상이 아니라 커밋 포함이 맞다(memory: "review/ 는 gitignored 아님(SUMMARY·RESOLUTION 도 커밋)"). 따라서 리뷰 산출물 22개는 스코프 이탈이 아니라 이번 작업 자체의 필수 흔적이다.

## 발견사항

발견된 스코프 이탈 없음.

- **[INFO]** 테스트 추가 3건은 리뷰 라운드에서 지적된 WARNING 에 대한 직접 대응
  - 위치: `execution-status-response.dto.spec.ts`(SoT 값 assertion 추가), `interact-ack-response.dto.spec.ts`(신규), `execution-status.literal.spec.ts`(신규)
  - 상세: 1R(19_49_01) W1/W2 가 "SoT 값 검증 부재"·"InteractAckDto 스키마 회귀 테스트 부재" 를 지적했고, 2R(20_08_27) W1 이 "drift 가드가 순서 회귀를 무음 통과"(tautological 비교) 를 추가로 지적했다. 세 신규/확장 테스트 파일은 정확히 이 세 WARNING 을 해소하는 범위로 국한되어 있고, 그 외 무관한 테스트 리팩터링은 없다. RESOLUTION.md 문서(파일 8, 19)의 서술과 실제 diff 가 1:1 대응.
  - 제안: 조치 불필요 (범위 내 정당한 확장).

- **[INFO]** `enum: [...SPREAD]` → `enum: DIRECT_REF` 스타일 변경도 리뷰 지적사항 반영
  - 위치: `execution-status-response.dto.ts`, `interact-ack-response.dto.ts` 의 `@ApiProperty({ enum: EIA_EXECUTION_STATUS_VALUES })`
  - 상세: 1R maintainability I2(spread 가 모듈 관례 `INTERACT_COMMANDS` 직접 참조와 불일치)를 반영해 스프레드를 제거하고 직접 참조로 통일했다. RESOLUTION.md 에 "readonly 호환 확인 후 반영"으로 명시돼 있고 diff 도 그와 일치한다 — 요청 범위(SoT 통합) 밖 임의 스타일 변경이 아니라 같은 리뷰 루프에서 나온 지적의 후속.
  - 제안: 조치 불필요.

- **[INFO]** plan 파일 편집은 developer 권한 내 정상 갱신
  - 위치: `plan/in-progress/eia-context-schema-followups.md`
  - 상세: `worktree` frontmatter 정정(`eia-client-context-types-33e771` → `eia-context-dev-cleanups-109831`, 실제 사용 중인 worktree 와 일치시킴) + 체크박스 `[ ]→[x]` 전환 + 완료 노트(2R 반영 결과 반영: 상수명 `EIA_` 접두·직접 참조·테스트 21건으로 정정) + "잔여 (별 slice)" 후속 항목 안내 문구 추가. 전부 이번 작업 완료 상태를 반영하는 진행 기록이며 `spec/`·타 백로그 항목에는 영향 없다.
  - 제안: 조치 불필요.

- **[INFO]** 무관 심볼 동명(`EXECUTION_STATUS_VALUES` in `explore-tools.service.ts`) — 오탐 배제
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts`
  - 상세: 여러 reviewer(documentation/side_effect/maintainability, 파일 12·13·17)가 동명 상수 존재를 지적했고 개명(`EIA_` 접두)으로 대응했으나, `explore-tools.service.ts` 자체는 이번 diff 에서 전혀 건드리지 않았다(git diff --stat 미포함). 스코프 밖 파일에 손대지 않은 것이 확인됨.
  - 제안: 조치 불필요.

## 파일별 상세

1. `execution-status.literal.ts`(신규): `EIA_EXECUTION_STATUS_VALUES`/`ExecutionStatusLiteral` 단일 목적 파일. JSDoc 은 명명 근거(EIA_ 접두·Literal 접미)와 엔티티 비파생 설계 근거만 담아 과도하지 않음.
2. `execution-status-response.dto.ts` / `interact-ack-response.dto.ts`: `status`/`currentStatus` 필드의 인라인 유니온 + swagger `enum` 배열을 신규 SoT import 로 교체한 것 외 다른 변경 없음(각 diff 가 해당 필드 선언부에 정확히 국한).
3. 세 `.spec.ts` 신규/확장은 위 INFO 서술대로 리뷰 WARNING 대응 범위에 국한.
4. 코드 파일 전반에 포맷팅-only 변경·불필요 임포트·무관 주석 변경 없음. 신규 import 는 전부 실사용.
5. `review/**` 22개는 리뷰 워크플로 자체의 표준 산출물 경로(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)이며 코드/스코프 변경이 아니다.

## 요약
이번 변경은 plan 에 사전 등록된 단일 백로그 항목(두 DTO 의 중복 `status` 리터럴 유니온을 로컬 SoT 로 통합)과, 그 결과물에 대해 수행된 2라운드 `/ai-review` 에서 나온 WARNING(테스트 커버리지 갭 3건, spread 스타일 불일치 1건)을 그대로 반영한 것으로 구성된다. `git diff origin/main --stat` 확인 결과 payload 의 29개 파일 외 추가 변경이 없고, 코드 파일 diff 는 해당 필드 선언부 및 그 테스트에만 국한되어 불필요한 리팩토링·포맷팅·임포트 정리·기능 확장이 전혀 발견되지 않았다. plan 파일 갱신과 `review/**` 산출물은 각각 developer 쓰기 권한 범위·리뷰 워크플로 표준 저장 위치에 해당하는 정상 기록이다.

## 위험도
NONE
