# consistency SUMMARY — `17_21_43` (`--impl-done spec/conventions`)

## BLOCK: NO

Critical **0건**. checker 5/5 착지, 전원 BLOCK:NO.

| checker | 위험도 | 발견 |
|---|---|---|
| naming_collision · rationale_continuity · plan_coherence | **NONE** | 0 |
| convention_compliance | **NONE** | INFO 3 |
| cross_spec | LOW | INFO 1 |

## 값을 낸 지점

- **rationale_continuity — 두 가설을 실측으로 갈랐다.**
  ① "코드가 먼저이고 §3.2 가 사후 정당화인가?" → `git log -S` 로 §3.2 는 `ca227cc36`
  (**2026-03-26**), `/stop` 의 `@Roles('editor')` 는 `8d84f6e9f4`(**2026-08-08**) — **spec 이
  4개월 먼저**다. 순서 역전 아님.
  ② "EIA `R14`(403 미사용)와 충돌하는가?" → R14 는 EIA `interaction-token` 표면 전용이고,
  내부 API 는 `FORBIDDEN`·`NOT_A_MEMBER` 등으로 **403 을 이미 전역 표준**으로 쓴다. 별개 표면.
  두 가설 모두 **엄격히 세우고 반증**했다.

- **convention_compliance — 51/51 전수 대조.** `@Roles()` 보유 이웃 라우트는 안 건드리고
  기존 role-specific 문구를 보존했음을, 51건 전부 `'워크스페이스 멤버가 아님'` 으로 통일됐음을
  각각 확인. `@Public()` 이 대상 16파일에 0건임도 grep 으로 확인. 그리고 **잔여 12건**을
  독립으로 찾아냈다(내 실측 13과 근사 — 이 라운드의 핵심 발견).

- **plan_coherence — 형제 plan 과의 파일 충돌을 실측했다.** `backend-lint-gate-broken-on-main`
  의 잔여 작업 대상(`secret-resolver.service.ts`·`migrate-node-output-refs.ts` 등)과 내가 만진
  16 컨트롤러의 교집합 **0건**. `auth-guard-reflection-hardening` 과도 0건. 또 같은 spec 파일
  (`node-cancellation.md`)에 열린 미해결 결정(SIGTERM/timeout 분류, §5.1/§8/§11)이 내 편집
  범위(§2.3)와 **겹치지 않음**을 확인했다.

- **naming_collision — 앵커 슬러그를 손으로 산출해 대조.** GitHub 규칙(백틱·괄호·em-dash
  제거, em-dash 자리에 `--`)으로 계산한 값이 내가 넣은 프래그먼트와 정확히 일치. 동일 헤딩
  중복 0이라 `-1` 접미 상황도 아님.

## 처분한 INFO

| # | checker | 내용 |
|---|---|---|
| 1 | plan_coherence | 후속 항목이 인용한 **§5-4 → §2-4** (401 요구는 §2-4 소관) |
| 2 | convention | §4 표 `**Editor+**` bold 가 선례(`13-replay-rerun.md:482`)와 불일치 |
| 3 | cross_spec | `1-auth §3.2` 를 따옴표로 감쌌으나 **verbatim 이 아님**(표의 paraphrase) |

**#3 이 실질적이다** — 그 문자열로 `1-auth.md` 를 grep 하면 안 나오므로, 나중에 재검증하려는
사람이 "인용이 틀렸다" 고 오판한다. 표 참조 서술로 바꿨다.

## 무조치

- convention INFO: 데코레이터 배치 순서(401→403→404)가 `swagger.md` 본문에 **명문화돼 있지
  않고 선례뿐**이다 — 51곳이 100% 지켰으니 규약 승격 가치가 있다는 제안. 이 티켓 범위 밖.
- convention INFO: §5-4 는 "**새** 엔드포인트 체크리스트" 라 기존 코드 전수 소급을 의무화하는
  문언은 아니다 — 그럼에도 잔여 13건을 닫은 것은 이 PR 이 스스로 정한 완결 기준이다.
- plan_coherence INFO: 실측 표의 raw 서브합계 ±1(141/75 vs 142/76). 포함-배제로 역산하면
  대상 수는 동일(`142−76−79+64 = 51`)이라 결론에 영향 없음. **두 파서의 경계 처리 차이**이며
  어느 쪽이 옳다고 단정하지 않는다 — 그래서 plan 에는 술어를 명시해 적었다.
