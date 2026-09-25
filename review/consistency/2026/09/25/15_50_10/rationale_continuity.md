# Rationale 연속성 검토 — spec-draft-workspace-path-guard-followup

대상: `plan/in-progress/spec-draft-workspace-path-guard-followup.md` (변경 1~4).
관련 SoT Rationale: `spec/data-flow/12-workspace.md`(§"경로 파라미터 워크스페이스도 가드가 본다 (2026-09-25)"·
§"가드 거부의 오류 코드 (2026-09-25)"), `spec/5-system/1-auth.md`(§부트 캐너리 (a)/(b)),
`spec/conventions/error-codes.md`(§3/§5), `spec/conventions/swagger.md`(frontmatter `code:`).

## 배경 확인

이 target 은 새 결정을 제안하지 않는다 — 같은 PR 의 spec 커밋 `e2e257707` 이 이미 `data-flow/12-workspace.md`
의 Rationale 에 착지시킨 결정("경로 파라미터 워크스페이스도 가드가 본다")을 인접 문서 세 곳에 **미러링만
완결**하는 후속 정정이다. 직전 `--impl-prep`(`review/consistency/2026/09/25/15_15_21`, BLOCK:NO)이 정확히
같은 항목 넷(WARNING 1 cross_spec·WARNING 2 rationale_continuity·WARNING 3 convention_compliance·INFO 1
rationale_continuity)을 지목했고, target 의 변경 1~4 는 그 제안된 해법과 문구까지 거의 동형이다.

실측으로 아래를 확인했다:
- `spec/2-navigation/9-user-profile.md:159` — 변경 1 의 "전" 인용문과 현재 파일 내용이 정확히 일치.
- `spec/5-system/1-auth.md:827-831` — 변경 2 의 "전" 인용문(부트 캐너리 (b) 마지막 문장)과 현재 파일 내용이
  정확히 일치.
- `grep -rn "workspace-param-binding\|param-uuid-pipe\|workspace-roles-attachment" spec/` — 변경 3 이 주장한
  "0건"(어느 spec 의 `code:` 에도 미등재)을 확인. `spec/conventions/swagger.md` 의 `code:` 는 실제로 가드
  본체·fixture 를 개별 glob 으로 등재하고 있어(디렉터리 통짜 glob 없음), 변경 3 이 "기각한 대안"(통짜 glob)
  주장의 근거도 실측과 일치한다.
- `spec/conventions/error-codes.md` §3 `invitation_not_found` 행 비고에 이미 "(2026-09-25 `forbidden` 을
  이 행에서 뺐다 — 발행처 0건)" 실측이 적혀 있음을 확인 — 변경 4 가 인용하는 선례가 실재한다.

## 발견사항

- **[INFO]** 변경 4 의 일반 원칙("발행된 적 없는 코드는 이 표에 오지 않는다")이 §5(Rename 이력) 머리말에
  들어가지만, 실제 선례(`forbidden` 제거)는 §5 가 아니라 §3(Historical-artifact 예외 레지스트리) 행 비고에
  있다
  - target 위치: `plan/in-progress/spec-draft-workspace-path-guard-followup.md` 변경 4, `error-codes.md`
    §5 첫 문단 뒤 추가문
  - 과거 결정 출처: `spec/conventions/error-codes.md` 자신의 Rationale "§3 은 부정확한 이름이나 *유지*되는
    active 코드의 예외 등록부다. *교체·은퇴된* 구 코드의 rename 이력은 §5 에 둔다 (목적 레이어가 다르다)"
  - 상세: §3/§5 는 이 문서 스스로 "목적 레이어가 다르다"고 선언한 별개 레지스트리다. `forbidden` 은 발행
    이력이 없어 애초에 "rename"이 아니므로 §5(rename 이력) 대상이 아니라는 target 의 논리 자체는 맞고, 그
    귀결("이 표(§5)에 오지 않는다")도 참이다. 다만 그 경계 원칙을 §5 머리말에 적으면서 예시로 "2026-09-25
    §3 의 forbidden"을 드는 구조라, 향후 §5 만 읽는 사람은 실제 처리 기록(§3 행 비고)을 못 찾고 §5 에서
    "그런 사례가 어디 있지" 반문할 수 있다. 이는 원칙과 실제 기록 위치가 문서상 분리돼 있다는 점에서 사소한
    가독성 갭이며, 어떤 invariant 위반이나 결정 번복은 아니다.
  - 제안: (선택) §5 추가문 끝에 "실제 처리 기록은 §3 [해당 행]" 으로 역참조 한 줄을 붙이면 §5/§3 분리 원칙과
    완전히 정합해진다. 굳이 이번 턴에서 고칠 필요는 없다(target 자신도 이 항목을 INFO 로 분류해 낮은
    우선순위로 다뤘고, 그 판단은 타당하다).

## 요약

target 의 네 변경은 모두 **새 결정이 아니라 이미 `data-flow/12-workspace.md` Rationale 에 착지한 결정("경로
파라미터 워크스페이스도 가드가 본다"·"가드 거부의 오류 코드")의 전파 누락을 닫는 미러링**이다. 핵심 우려로
꼽힐 만한 지점 — `@WorkspaceParam` 도입이 이 저장소가 두 번 재기각한 "라우트별 opt-in 마커" 패턴을 이유 없이
재도입하는가 — 은 이미 `data-flow/12-workspace.md` 자신의 Rationale 이 "값 바인딩 그 자체 vs 메타데이터 부착"
구분으로 명시적으로 해소해 두었고, target 의 변경 2 는 그 기존 논거를 `1-auth.md` §부트 캐너리 (b)에 역방향
각주로 인용만 할 뿐 새로운 주장을 보태지 않는다. 변경 1 도 같은 논거를 `9-user-profile.md`에 미러링하는
것이고, 변경 3 은 이미 시행 중인 개별-glob 원칙(swagger.md 실측)을 따라 신규·기존 가드 셋을 `code:` 에
등재하는 것으로 원칙과 정합한다. "전" 인용문은 모두 현재 spec 파일과 실측 일치해, 이력을 지어내거나
소급 부여한 흔적이 없다. 기각된 대안 재도입, 원칙 위반, 무근거 번복, invariant 우회 — 네 관점 어디에서도
CRITICAL/WARNING 급 문제를 찾지 못했다. 유일한 지적은 §5/§3 인용 위치에 관한 가독성 INFO 뿐이다.

## 위험도
NONE
