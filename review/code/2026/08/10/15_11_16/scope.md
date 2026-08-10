# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** PR 범위가 §1(peer dependency 게이팅)에만 정확히 제한돼 있다
  - 위치: 전체 diff — `.claude/tests/test_pnpm_workspace_action.py`, `.github/actions/pnpm-workspace/action.yml`, `plan/in-progress/deps-peer-gating-and-eslint10.md`, `pnpm-workspace.yaml`
  - 상세: 4개 파일 모두 `--strict-peer-dependencies` 도입(§1)에 직접 결속돼 있다. `eslint.config.mjs`, 각 워크스페이스 `package.json` 의 eslint 버전 선언, `dependabot.yml` 등 §2(eslint 10 상향, 10개 워크스페이스)에 속하는 파일은 일절 건드리지 않았다. 계획 문서 체크리스트도 §1 두 항목만 `[x]`로 갱신했고 §2 세 항목은 `[ ]` 그대로다(plan 라인 92-97). 스코프 경계가 실제 diff 와 문서 상태 양쪽에서 일관되게 지켜졌다.
  - 제안: 없음 — 스코프 유지가 잘 된 사례.

- **[INFO]** `pnpm-workspace.yaml` 에 실제 억제 규칙(`peerDependencyRules`)을 남기지 않고 주석만 추가한 것은 §1 결론(억제 대상 자체가 없었음)과 정확히 일치
  - 위치: `pnpm-workspace.yaml:124-138`
  - 상세: plan 문서(라인 61-67)에 기록된 대로, 실측 결과 억제 규칙 없이도 `unmet peer 0건`이었고, 넣었던 억제는 되돌렸다고 적혀 있다. diff 를 보면 실제로 `peerDependencyRules:` 키 자체가 추가되지 않고 설명 주석만 남아 최종 파일 상태와 서술이 어긋나지 않는다. 죽은 설정을 남기지 않은 점에서 스코프를 넓히지 않았다.
  - 제안: 없음.

- **[INFO]** plan Rationale("§1 이 §2 의 안전망이라 순서는 §1 → §2") 은 **순서**(§1 선병합)를 정당화하는 근거로는 타당하지만, "**별도 PR 로 쪼갤 필요**"까지 강제하지는 않는다 — 다만 이번 PR 이 §1 로 좁게 유지된 것 자체는 스코프 관점에서 옳은 선택이다
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:101-102`(변경되지 않은 기존 서술, 이번 diff 범위 밖) — 근거로 인용한 §2 규모는 `plan/in-progress/deps-peer-gating-and-eslint10.md:86` ("10개 워크스페이스 매니페스트 + 각 `eslint.config.mjs` 호환성 + 룰 시그니처 변경 대응")
  - 상세: "peer 게이트 없이 eslint 10 으로 올리면 같은 불일치가 또 조용히 통과한다"는 논리 자체는, §1 과 §2 를 **같은 PR** 에 넣고 §1 커밋을 먼저 적용해도 동일하게 성립한다(같은 PR 의 CI 에서 strict-peer 게이트가 §2 커밋에 대해서도 작동하므로). 즉 이 rationale 만으로는 "왜 별도 PR"인지까지는 설명하지 못하고, "왜 §1 이 §2 보다 먼저 확정돼야 하는가"만 설명한다. 그럼에도 §2 자체가 10개 워크스페이스 매니페스트 + config 호환성 + 룰 시그니처 대응이라는 훨씬 큰 배치이므로, batch 축소·리뷰 용이성 관점에서 이번 PR 을 §1 단독으로 닫은 판단은 스코프 규율상 합리적이다. rationale 문구가 "분리"의 근거로는 다소 약하지만, 결과(이번 PR 의 좁은 범위)를 무효화할 정도는 아니다.
  - 제안: (선택) plan Rationale 에 "왜 같은 PR 대신 별도 PR 인가"(배치 크기·리뷰 용이성)를 한 줄 보강하면 §1→§2 순서 논거와 분리 논거가 분명히 구분된다. 필수 아님.

- **[INFO]** "안전망"의 실효성은 저장소 레벨 GitHub Actions 활성화에 의존하나, 이는 이미 plan Overview 에 별도 스코프 아웃으로 공개돼 있어 숨은 전제가 아니다
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:16-18`(변경되지 않은 기존 서술)
  - 상세: "Actions 가 repo 레벨에서 꺼져 있어 dependabot PR 이 아무 검증 없이 머지된다... 그건 저장소 설정 소관이라 파일로 못 고치므로 여기서 다루지 않는다(사용자 확인 대기)"라고 이미 명시돼 있다. 즉 §1 게이트가 실제로 §2 를 지켜주려면 Actions 재활성화가 선행돼야 하는데, 이 의존성은 이번 diff 가 새로 만든 것이 아니라 기존에 이미 공개적으로 스코프 아웃된 항목이다. scope 위반은 아니고 후속 추적을 위한 참고 사항.
  - 제안: 없음(이미 문서화됨). §2 착수 전 Actions 활성화 여부를 재확인하는 것을 권장.

CRITICAL/WARNING 급 스코프 이탈은 발견되지 않았다. 포맷팅 전용 변경, 무관한 리팩토링, 미사용 임포트, 의도치 않은 설정 변경도 확인되지 않았다.

## 요약

이 PR 은 티켓의 §1(peer dependency 게이팅)에만 정확히 결속돼 있다 — 테스트(`test_pnpm_workspace_action.py`)·실제 액션(`action.yml`)·정책 주석(`pnpm-workspace.yaml`)·진행 기록(plan 문서) 4개 파일 모두 `--strict-peer-dependencies` 도입과 그 조사 과정(nunjucks→chokidar 전제 반증, 억제 규칙 추가 후 롤백)에만 관련되며, §2(eslint 10 상향, 10개 워크스페이스)에 속하는 파일은 전혀 건드리지 않았고 plan 체크리스트도 그 경계를 정확히 반영한다. 사용자가 판정을 요청한 "§1 이 §2 의 안전망이라 순서는 §1 → §2" 근거는, 엄밀히는 **선병합 순서**를 정당화할 뿐 **별도 PR 로의 물리적 분리**까지 논리적으로 강제하지는 않는다(같은 PR 안에서 §1 커밋을 앞세워도 안전망 효과는 동일하게 성립). 다만 §2 자체가 10개 워크스페이스 매니페스트 + config 호환성 검증이라는 훨씬 큰 배치라는 사실이 별도 PR 분리를 배치-크기 관점에서 충분히 뒷받침하므로, 결과적으로 이번 PR 이 §1 단독으로 좁게 유지된 것은 스코프 규율에 부합하는 정상적인 판단이다. "안전망"의 실질적 방어력이 저장소 레벨 Actions 활성화(현재 비활성, 사용자 확인 대기)에 달려 있다는 점도 이미 plan Overview 에 공개돼 있어 숨은 전제가 아니다.

## 위험도

NONE
