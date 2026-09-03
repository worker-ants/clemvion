# 문서화(Documentation) 리뷰

## 검토 범위

`WorkspaceInvitationDto.invitedBy` nullable 정정(+ 리뷰 1R 의 W1/W2/W3 조치 결과)을 대상으로,
CHANGELOG·JSDoc/Swagger 주석·테스트 docstring·plan 문서 4개 실제 변경 파일과, 첨부된 이전 리뷰
라운드(`20_02_03`) 산출물 13개(historical review artifacts)를 검토했다.

## 사실 검증 (Read/Grep 로 원본 대조)

아래 문서화 내용이 실제 코드/DB 와 일치하는지 직접 확인했다 — 전부 일치:

- `codebase/backend/migrations/V017__workspace_invitations.sql:15` — `invited_by UUID REFERENCES
  "user"(id) ON DELETE SET NULL` 확인. plan 의 "V017:15" 인용, CHANGELOG 의 "ON DELETE SET
  NULL(V017)" 서술 모두 정확.
- `codebase/backend/src/modules/workspaces/workspaces.controller.ts:402` — `invitedBy:
  i.invitedBy` 코어션 없는 통과 확인. DTO JSDoc·plan·CHANGELOG 서술과 일치.
- `codebase/frontend/src/lib/api/workspaces.ts:154` — `invitedBy: string | null` 확인. "FE 는
  이미 nullable 로 다루고 있었다" 는 CHANGELOG/plan 의 주장이 정확.
- `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts:40` —
  `acceptedBy: string | null` 이지만 응답 DTO(`workspace-response.dto.ts`) 어디에도 노출 안 됨
  확인. plan 의 "형제 `acceptedBy` 는 노출되지 않는다" 주장이 정확.
- `spec/5-system/2-api-convention.md:174-186` (§5.4) — 신규 `invitedBy?: string | null` +
  `@ApiPropertyOptional({ nullable: true })` 조합이 "null(키 present)" 규칙 문면과 정확히
  일치. CHANGELOG 의 "형태는 §5.4 를 따랐다" 주장 확인됨.

## 발견사항

- **[INFO]** 테스트 docstring 이 두 테스트를 한 묶음으로 설명하지만, 실제로 인자 검증
  (`toHaveBeenCalledWith`)은 첫 번째 테스트에만 있고 대조군(두 번째) 테스트에는 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:60`(블록 docstring, 게이트 60-69) 및 `:88-103`(대조군 테스트, 게이트 88-103)
  - 상세: 블록 docstring(게이트 61-69)은 "이 테스트가 고정하는 것은 **통과 동작**이다" 라고 두
    테스트를 아우르는 어조로 설명하지만, `toHaveBeenCalledWith('ws-1', user.sub)` 인자 검증은
    첫 번째 테스트(게이트 84)에만 있고 `[대조군]` 테스트(게이트 88-103)는 반환값만 검증한다.
    RESOLUTION.md 의 W1 조치 설명("`expect(...).toHaveBeenCalledWith(...)` 추가")도 몇 건
    추가했는지 명시하지 않아 이 비대칭이 의도인지 누락인지 문서만으로는 판단하기 어렵다.
  - 제안: 대조군 테스트에도 동일한 `toHaveBeenCalledWith` 를 추가하거나(완전 대칭), 의도적으로
    한쪽만 검증한 것이면 docstring 에 "인자 검증은 첫 테스트로 충분 — 같은 mock 호출이라 대조군
    반복 불필요" 같은 한 줄 근거를 남긴다. (testing 관점과 겹치는 낮은 우선순위 항목.)

- **[INFO]** CHANGELOG 의 "§5.4 를 따랐다" 서술이 §5.4 자체의 미해결 내부 모순을 언급하지 않음
  - 위치: `CHANGELOG.md` 신규 항목 중 "형태는 [API 규약 §5.4]... 를 따랐다" 문장(게이트 17-18)
  - 상세: 같은 커밋의 `plan/in-progress/entity-nullable-column-type-mismatch.md` 는 별도로
    "§5.4 의 `field?:` 표기와 기존 선례(`AuthConfigUsageCallDto.sourceIp`)가 어긋난다" 는
    planner-턴 후속 항목을 이미 열어 두고 있다(게이트 233-242, 이번 diff 밖·기존 항목). CHANGELOG
    독자가 plan 을 보지 않으면 "§5.4 를 따랐다" = "형태가 확정·일관됐다" 로 오해할 여지가 있다.
    실질적으로는 규약 **문면**은 정확히 따랐고(체커도 확인) 문제는 규약 문면 자체의 내부
    비일관성이므로, 이번 diff 의 결함은 아니다 — 다만 CHANGELOG 만 읽는 외부 소비자 입장에선
    참고할 단서가 없다.
  - 제안: 조치 불요(범위 밖). 굳이 개선한다면 CHANGELOG 항목 끝에 "표기 자체의 일관성 문제는
    별도 planner 턴에서 다룸" 한 줄만 덧붙이는 정도.

## 확인된 우수 사례 (참고)

- DTO JSDoc(`workspace-response.dto.ts:105-108`)이 "왜 nullable 인가"(FK `ON DELETE SET NULL` +
  대기 중 초대 잔존)를 근본 원인까지 설명 — 단순히 타입만 바꾸지 않고 향후 유지보수자가 왜
  이렇게 선언됐는지 추적할 수 있게 함.
- CHANGELOG 항목이 종전/지금 표 + 영향(클라이언트 타입 생성 영향, wire 바이트 불변, FE 는 이미
  대응돼 있었음)까지 구조적으로 기술 — 리포지토리의 기존 `ipWhitelist` 항목과 형식이 통일됨.
  직전 리뷰 라운드(1R)에서 이 항목이 **누락**됐다가(W2) 이번 diff 에서 정확히 조치된 것도 확인.
- plan 문서가 이전 결론(48건 미해결 + 가드 신설 필요)을 **삭제하지 않고** 취소선 + 반증 근거 +
  전방 포인터 배너로 남겨, "당시 판단의 이력"과 "현재 결론"을 구조적으로 분리 — 리뷰 1R 의 W3
  ("같은 턴에 쓴 규칙을 다시 어김")를 정확히 겨냥한 조치이고, 재확인 결과 남은 모순 없음
  (`48건` 3회 인용 전수 확인, 전부 정합).
- 새 "정본(라이브 스키마) 대조" 절이 인용하는 파일 경로·줄 번호(V017:15,
  `workspaces.controller.ts:402`)가 실제 소스와 정확히 일치함을 직접 대조로 확인.

## README/설정 문서/API 문서 필요성

- README 업데이트 불요 — 새 기능·설정·환경변수 없음, 기존 엔드포인트의 응답 타입만 정정.
- 별도 API 문서(`spec/`) 갱신 불요 — `spec/5-system/1-auth.md:243` 는 `invitedByName`(다른
  필드, `InvitationMetaDto`)만 언급하며 이번 diff 의 `invitedBy`(`WorkspaceInvitationDto`)와
  무관함을 확인. Swagger 데코레이터가 유일한 계약 표현이고 이번 diff 로 정확해짐.
- CHANGELOG 갱신 완료 확인 — 리뷰 1R W2 지적이 이번 diff 에 반영됨.

## review/ 산출물(파일 5~17, `20_02_03` 세션 기록)에 대한 메모

이 파일들은 직전 리뷰 라운드의 자동 생성 산출물(SUMMARY/RESOLUTION/reviewer 리포트)이 새 파일로
추가된 것으로, 문서화 관점에서 "고쳐야 할 코드 주석/독스트링"이 아니라 리뷰 이력 그 자체다.
RESOLUTION.md 가 SUMMARY.md 의 W1/W2/W3 지적과 이번 diff 의 실제 조치가 1:1 로 대응함을 확인했고
(테스트 인자 검증 추가·CHANGELOG 신설·plan 배너 추가), 불일치 없음.

## 요약

`invitedBy` nullable 정정 변경은 문서화 품질이 높다 — DTO JSDoc·CHANGELOG·테스트 docstring·plan
서술 모두 근본 원인(FK `ON DELETE SET NULL`)을 일관되게 설명하고, 인용된 모든 소스 위치(V017:15,
controller.ts:402, workspaces.ts:154 등)를 직접 대조한 결과 전부 정확했다. 직전 리뷰 라운드에서
지적된 CHANGELOG 누락·plan 문서 내부 모순은 이번 diff 에서 실제로 해소됐다. 남은 것은 테스트
docstring과 실제 검증 범위의 미세한 비대칭, CHANGELOG 가 §5.4 의 미해결 내부 이슈를 언급하지
않는다는 두 개의 INFO 급 관찰뿐이며 둘 다 이번 PR 스코프의 실질 결함은 아니다.

## 위험도

NONE
