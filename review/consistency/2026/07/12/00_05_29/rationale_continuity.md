### 발견사항

- **[INFO]** "사용자 결정" 절의 옵션 라벨 (a)/(b)/(c) 가 문서 내 선행 정의 없이 사용됨
  - target 위치: `plan/in-progress/spec-draft-webchat-i18n-scope.md` §"사용자 결정 (2026-07-12)" ("문서 범위: (a)+(b) 둘 다") 및 §"Rationale (본 draft)" ("(c) dict 채택 기각")
  - 과거 결정 출처: 해당 없음 (문서 자체의 자기완결성 문제)
  - 상세: (a)/(b)/(c) 가 무엇을 가리키는지 본 draft 안에 정의가 없다. 실제 Edit A~D 내용으로 미루어 (a)=i18n-userguide 적용범위절, (b)=product-overview 비목표 추가, (c)=위젯에 dict-indirection 도입안 정도로 추정 가능하지만, 이는 세션 대화에서만 존재하고 문서에는 남아있지 않다. Rationale 연속성 관점에서 "기각된 대안"이 실제 이력인지 추적 가능해야 하는데(과거 교훈: `feedback_rationale_rejected_alternatives_need_history`), 이 라벨들은 target 문서 자체만으로는 검증 불가능한 참조다.
  - 제안: 최종 spec 반영 시(Edit A/C의 Rationale 문구)에는 이미 산문으로 완전히 풀어 썼으므로 실질 영향 없음 — 다만 plan 문서 자체에 "(a) i18n-userguide 적용범위, (b) product-overview 비목표, (c) 위젯 dict 도입안(기각)" 식으로 괄호 라벨을 1회 정의해두면 추후 재검토 시 추적성이 좋아진다.

관련해 확인한 사항 (문제 없음, 참고용):

- **`spec/conventions/i18n-userguide.md`** 는 현재 적용 범위(scope)를 명시하지 않고 "모든 신규·변경 코드" 라고만 서술한다(§본문 3행). `code:` frontmatter·본문 어디에도 `channel-web-chat` 관련 서술이 없어 target 의 "규약이 침묵한다"는 전제는 사실과 일치한다. 즉 이번 draft 는 **기존 결정의 번복이 아니라 공백을 메우는 최초 확정**(cf. `spec/2-navigation/1-workflow-list.md` Rationale §4 의 "결정의 번복이 아니라 최초 확정" 과 같은 패턴)이다.
- `hardcoded-korean-ratchet.test.ts` (`SCAN_ROOTS = ["components","app","lib"]`, `codebase/frontend/src` 기준) 와 `.claude/config/doc-sync-matrix.json` 의 `new-ui-string` glob(`codebase/frontend/src/**/*.tsx`) 을 직접 확인한 결과, 둘 다 `codebase/channel-web-chat` 를 스캔하지 않는다 — target 의 §"배경 3" 주장은 코드 실측과 일치한다.
- `spec/7-channel-web-chat/_product-overview.md` §2 비목표, `2-sdk.md` §Rationale(R2~R5, R6 미존재), `5-admin-console.md` §Rationale(R1~R7) 을 전수 확인했으나 "위젯 EN 다국어화" 또는 "locale 필드 처리" 를 명시적으로 다룬 기존 Rationale 항목이 없다 — 즉 이번 draft 가 뒤집는 기존 결정 자체가 없다(따라서 criterion 3 "결정의 무근거 번복" 은 해당사항 없음). Edit A/C 가 각각 새 Rationale 항목("왜 dict-indirection 스코프 밖인가", "R6. locale 은 reserved")을 신설하는 것도 규약("결정을 뒤집을 땐 새 Rationale 동반")에 부합한다(이번 경우는 신규 결정이라 엄밀히는 의무 대상은 아니지만 선제 준수).
- 오히려 **강한 정합 신호**: `spec/conventions/conversation-thread.md` §397 근처의 "스코프 예외 — 임베드형 채널 위젯" Rationale 이 이미 동일 위젯(`7-channel-web-chat`)에 대해 "전역 UI 계약(§9.1/§9.2)을 따르지 않고 별도 축약 렌더를 쓰며, 이는 결정의 번복이 아니라 적용 범위 분리다" 라는 동일 설계 패턴(글로벌 규약 + 위젯 전용 carve-out + 명시적 Rationale)을 이미 확립해 두었다. 이번 draft 의 i18n Principle 1·2 carve-out 은 이 기존 패턴을 그대로 계승하는 형태로, "합의된 원칙"(criterion 2) 과 오히려 정합적이다.
- `PROJECT.md §변경 유형 → 갱신 위치 매핑` 표 전 항목이 `codebase/frontend/src/...` 만 가리키고 `channel-web-chat` 을 언급하지 않아, cross-cutting 레벨에서도 상충하는 기존 확정 사실이 없다.
- `5-admin-console.md` §Rationale R2(외형 per-instance 서버 저장, 2026-06-24 결정)는 "locale" 을 다루지 않으며, Edit D 가 건드리는 §4:117-118 위치와 무모순이다. side-effect 점검 대상에 언급된 §6.1:214 ("endpointPath/locale 변경 시 iframe 재마운트") 문구도 실측 확인 결과 정확히 인용됐고 reserved 프레이밍과 상충하지 않는다.

### 요약
target draft 는 기존 spec 의 어떤 `## Rationale` 항목도 재도입·번복하지 않는다 — i18n-userguide.md 는 적용 범위에 대해 실제로 침묵하고 있었고(코드 실측: ratchet test·doc-sync-matrix 스캔 루트가 이미 `channel-web-chat` 밖), 7-channel-web-chat 3개 문서의 기존 Rationale 어디에도 locale/EN 다국어화를 다룬 선행 결정이 없어 "번복" 대상 자체가 존재하지 않는다. 오히려 이 draft 가 채택하는 "글로벌 규약 + 위젯 scope carve-out + 명시적 Rationale" 패턴은 `conversation-thread.md §9` 의 기존 확립된 선례와 구조적으로 일치해 원칙 연속성이 강하다. 각 Edit(A/C)는 신규 결정에 새 Rationale 항목을 동반해 향후 추적성도 확보했다. 유일한 흠은 plan 문서 내부의 (a)/(b)/(c) 라벨이 문서 자체에서 선행 정의되지 않는 점으로, 실질 spec 반영본(Edit A~D 산문)에는 영향이 없는 INFO 수준 이슈다.

### 위험도
NONE

<!-- disk-write gap 복구본: workflow status=success 였으나 output 파일이 디스크에 기록되지 않아(알려진 실패 유형) main Claude 가 journal.jsonl 의 result 로부터 복원. -->
