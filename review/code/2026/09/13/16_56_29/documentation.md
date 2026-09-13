# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** 체크리스트의 자기참조 카운트(`#1331` 치환 대상 개수)가 지금 시점 실측과 어긋난다
  - 위치: `plan/in-progress/guide-identifier-existence.md:274` (본문: `` `grep -rn '#1331' plan/` 은 **10곳**을 낸다 — 이 파일의 3곳은 …``)
  - 상세: 직접 실행해 확인했다 — `grep -rn '#1331' plan/` 은 현재 **11곳**을 낸다(`spec-draft-nullable-notation-followups.md` 7곳 + `guide-identifier-existence.md` 자신 **4곳**: 268·274·276·314행). 문서는 "10곳"과 "이 파일의 3곳"이라고 적었지만 실측은 각각 11·4다. 원인은 이 노트 자체가 자기참조적이라는 데 있다 — `#1331` 을 언급하는 문장을 이 파일에 더 쓸 때마다 그 문장 자신이 카운트에 포함되어, 노트를 쓴 시점 이후 카운트가 늘어난다(실제로 314행의 "검증 불가능한 선행 참조" 문단이 이 노트보다 뒤에 추가됐다). 이 프로젝트가 반복해 지적해 온 "측정 시점 이후 자기 문서 안에서 값이 계속 바뀌는" 클래스와 같은 패턴이다.
  - 영향은 낮다 — 실제 치환 지시("`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 7곳만 치환하라")는 여전히 맞고, PR 번호가 확정된 뒤 실제 작업을 수행할 사람이 그 파일에 대해서만 grep 하면 올바른 결과를 얻는다. 다만 "전체 `plan/` 카운트가 10" 이라는 부수 진술을 검증 삼아 실행하면 즉시 불일치를 보게 되어 "내가 뭘 놓쳤나" 하는 불필요한 재확인을 유발한다.
  - 제안: 그 문장을 실측대로 "11곳(이 파일 자신의 4곳 포함)"으로 갱신하거나, 애초에 "`plan/` 전체 카운트"라는 자기참조적 보조 진술을 빼고 "치환 대상은 `spec-draft-nullable-notation-followups.md` 의 7곳뿐"이라는 핵심 문장만 남기는 편이 더 안전하다(그 문장은 이 파일 자신을 언급하지 않으므로 노트가 자라도 값이 안 변한다).

## INFO — 조치 불요, 관찰 기록

- **[INFO]** 이번 changeset 의 실질 소스 변경분(`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`)은 문서화 수준이 매우 높다. 각 정규식·함수마다 (1) 설계 결정의 이유, (2) 반증된 과거 주장과 정정 과정, (3) 뮤테이션 실측표, (4) "이 축이 못 보는 것"을 명시하는 한계 절이 JSDoc/블록 주석으로 함께 있다. `guide-sanitized-message-parity.test.ts:16-17` 의 자매 파일 상호참조도 리네임된 새 이름(`guide-identifier-existence.test.ts`)과 옛 이름(`#1330` 당시 `guide-error-code-existence.test.ts`)을 함께 병기해 최신 상태다 — 이전 라운드(`review/code/2026/09/13/14_41_14` dependency INFO#1)가 지적했던 stale 참조는 이번 diff 에서 이미 해소돼 있다.
- **[INFO]** `CHANGELOG.md`(66-82행)·`PROJECT.md`(300행)의 가드 카탈로그 서술은 실제 테스트 파일 내용(3축, 베이스라인 0, `GUIDE_EXTERNAL_VOCABULARY` 4강제, "존재 검사이지 방출 검사가 아니다" 한계, `MAKESHOP_UNRESOLVED_PATH_PARAM` 실측 사례)과 정확히 일치한다. "두 PR 에 걸쳐 두 번 바뀌었다"는 이력 서술도 코드 주석·plan 문서의 실측과 부합한다.
- **[INFO]** `spec/conventions/user-guide-evidence.md §2` 가 여전히 "Build-time 가드 (3건)"으로 4번째 가드(`guide-identifier-existence`)를 누락하고 있는 spec-drift 는 이번 diff 가 새로 만든 것이 아니라 `#1330` 때부터 있던 gap 이고, `spec/` 쓰기 권한이 없는 developer 가 `plan/in-progress/guide-identifier-existence.md §D`·`--impl-prep`(`review/consistency/2026/09/13/12_33_41`)를 통해 이미 planner 항목으로 등재했다(자기-반증형 소정정 예외 대상도 아님을 스스로 명시). `review/consistency/2026/09/13/16_28_53` convention_compliance.md 도 같은 결론이다 — 재등재 불필요.
- **[INFO]** 이번 diff 는 `package.json`/환경변수/설정 옵션을 신규로 추가하지 않는다(순수 테스트 인프라 리네임·확장). README 갱신 필요성 없음. API 엔드포인트 변경도 없어 API 문서 갱신 대상 없음.

## 요약

핵심 소스 변경(`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`)과 그에 따른 `CHANGELOG.md`·`PROJECT.md` 갱신은 문서화 관점에서 예외적으로 충실하다 — 설계 근거·반증 이력·한계 절이 모두 코드 곁에 있고 상위 카탈로그 문서와 정확히 일치한다. 유일하게 지적할 만한 것은 `plan/in-progress/guide-identifier-existence.md` 체크리스트의 자기참조 카운트(`grep -rn '#1331' plan/` "10곳" 주장)가 노트 자신이 자라며 실측(11곳)과 어긋나게 된 것으로, 실제 치환 작업 지시 자체는 정확해 실무 영향은 낮다. `user-guide-evidence.md §2` 카탈로그 미등재는 선재 gap 이며 이미 planner 항목으로 정당하게 위임돼 있어 새 지적 대상이 아니다.

## 위험도

LOW
