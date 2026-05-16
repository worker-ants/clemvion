# 유지보수성(Maintainability) 리뷰

## 발견사항

### CHANGELOG.md

- **[INFO]** CHANGELOG 항목 문장 길이 과도
  - 위치: CHANGELOG.md — 신규 추가된 "Test infrastructure" 섹션 단일 bullet
  - 상세: `make e2e-*` 동작과 결정 사유, BuildKit cache 설명, 회귀 사례가 모두 한 문장에 포함되어 있어 단락 구분 없이 읽기 어렵다. 특히 "누락 시 Docker layer cache 에 박힌 stale 이미지가 재사용되어 새로 추가한 컨트롤러 (예: ...) 가 컨테이너에 반영되지 않고 e2e 가 사일런트 404 로 실패하는 회귀가 발생함 (2026-05-15 background-monitoring 사례). BuildKit layer cache 가 변경 없는 layer 는 재사용하므로..." 를 한 bullet에 모아 240자+ 분량이 됨.
  - 제안: 사실(what) 과 근거(why) 를 두 bullet 또는 부연 단락으로 분리. 예: `- **`make e2e-*`가 매 실행마다 backend 이미지를 자동 rebuild** — `--build` 명시로 stale 이미지 회귀 차단.` + `> 2026-05-15 background-monitoring 사례: 새 컨트롤러가 Docker layer cache에 묻혀 e2e 404 실패. BuildKit은 미변경 layer를 재사용하므로 첫 build 이후 오버헤드는 작다.`

- **[INFO]** 언어 혼용(한/영) 스타일 일관성 부재
  - 위치: CHANGELOG.md L4 교체 후 본문
  - 상세: CHANGELOG 다른 항목들은 영어 위주("Implements the CONVENTIONS rulebook", "See [Spec 실행 엔진 §6.3]...")로 작성된 반면, 신규 추가된 "Test infrastructure" bullet은 한국어 위주. 동일 문서 내 혼용이 미래 기여자에게 기준이 불분명하게 느껴진다.
  - 제안: 기존 CHANGELOG 항목의 언어 톤을 기준으로 통일. 기술 용어는 영어, 설명 절은 한국어로 가는 방식이 이미 일부 적용되어 있으므로 신규 bullet도 같은 패턴 적용.

---

### Makefile

- **[INFO]** 인라인 주석 블록이 대상 target 선언과 분리되어 시각적으로 혼동 가능
  - 위치: Makefile — 신규 추가된 `e2e-test-full` 주석 블록 (라인 153–157)과 `e2e-test-full:` 선언 (라인 158)
  - 상세: 4줄짜리 설명 주석이 `e2e-test-full:` target 선언 바로 위에 blank line 없이 붙어있어, 주석이 위 target(`e2e-test`)에 속하는 것인지 아래 target(`e2e-test-full`)에 속하는 것인지 스캔 시 모호하게 보인다. Makefile의 일반적 컨벤션은 주석과 target이 같은 블록에 속함을 blank line 또는 `##` prefix로 명시한다.
  - 제안: 주석 첫 줄 앞에 빈 줄 1개를 삽입하거나, `e2e-test:` 블록 끝과 주석 블록 사이에 명시적 구분을 두어 어느 target의 설명인지 스캔 시 즉시 파악되도록 함.

- **[INFO]** help 텍스트 항목 간 서술 방식 불일치
  - 위치: Makefile help echo 블록
  - 상세: 기존 `e2e-down` 항목("e2e 리소스 정리 (volume·orphan 모두)")은 "(자동 image rebuild)" 설명을 추가하지 않았고, `e2e-up`/`e2e-test`/`e2e-test-full` 에만 추가됨. `e2e-down`은 rebuild와 무관하므로 정확하지만, 서술 패턴(부연 괄호 방식)이 항목마다 달라 일관성이 낮아 보임. `e2e-test`의 구 설명 "1-shot — 끝나면 자동 down"이 신규 표현 "1-shot — 자동 image rebuild, 끝나면 자동 down"으로 바뀌면서 쉼표 위치에 의해 rebuild와 자동 down의 순서 관계가 불분명해 보일 수 있다.
  - 제안: 일관된 서술 순서 유지. 예: "자동 image rebuild → 실행 → 자동 down" 순으로 통일.

---

### README.md

- **[INFO]** 신규 e2e 섹션 내 단락 길이가 길고 복수 정보 혼합
  - 위치: README.md — "격리 인프라 기반 e2e (`make e2e-*`)" 섹션 아래 마지막 단락
  - 상세: "세 `e2e-*` 타겟 모두 매 실행 시 `docker compose ... --build` 로 backend 이미지를 갱신한다. BuildKit layer cache 가 변경 없는 layer 는 재사용하므로 첫 build 이후 오버헤드는 작고, 새로 추가한 컨트롤러·라우트가 stale 이미지에 반영되지 않아 사일런트 404 로 실패하는 회귀를 차단한다." — 한 문장에 동작 설명, 최적화 이유, 회귀 방지 동기가 모두 포함. CHANGELOG와 동일한 내용이 중복 설명되고 있음.
  - 제안: `--build` 자동 rebuild 사실만 1줄로 기술하고, 상세 사유는 CHANGELOG 참조 링크로 유도. README는 "어떻게 쓰는가" 위주, CHANGELOG는 "왜 결정했는가" 위주로 역할 분리.

- **[INFO]** 디렉토리 트리 항목 설명의 서술 길이 불일치
  - 위치: README.md — 주요 경로 트리 블록
  - 상세: 기존 항목들(`frontend/`, `backend/` 등)은 짧은 단어 단위 설명을 사용하는 반면, 신규 추가된 `spec/` 항목 설명은 "제품 정의·기술 명세 (single source of truth — 옛 prd/ 도 흡수)"로 트리 내 다른 항목보다 현저히 길다. 공백 정렬도 맞지 않을 수 있다.
  - 제안: 트리 주석은 같은 칼럼 너비로 정렬 유지. 상세 설명은 트리 아래 별도 주석 또는 섹션에 두는 것을 고려.

---

### plan/in-progress/e2e-makefile-followup-2026-05-16.md

- **[WARNING]** plan 문서에 미체크 항목이 남아 있으나 commit에 포함됨
  - 위치: plan/in-progress/e2e-makefile-followup-2026-05-16.md — 체크리스트 하단
  - 상세: `- [ ] TEST WORKFLOW` 와 `- [ ] REVIEW WORKFLOW` 가 미완료 상태로 commit에 포함되어 있다. plan 문서는 진행 중 상태로 `in-progress/`에 위치하는 것이 맞으나, 커밋 메시지와 코드 diff 상에서 "구현 완료"로 읽힐 수 있어 실제 남은 작업이 있음을 인지하지 못하고 리뷰어가 plan을 완료 상태로 오해할 여지가 있다.
  - 제안: commit message나 PR description에 "TEST WORKFLOW / REVIEW WORKFLOW 는 별도 단계에서 처리 예정" 을 명시하여 미완 항목이 의도적으로 열려 있음을 리뷰어에게 알림. (CLAUDE.md의 plan 라이프사이클 규칙은 준수된 상태이므로 구조적 위반은 없음)

---

### review/consistency/2026/05/16/09_34_14/SUMMARY.md 및 _prompts/* 파일군

- **[INFO]** consistency check 아티팩트가 이 commit에 동시 포함됨
  - 위치: review/consistency/2026/05/16/09_34_14/ 하위 전체
  - 상세: consistency-check 수행 결과 파일들이 구현 commit과 동일 commit으로 묶여 있다. 리뷰 아티팩트는 리뷰 시점 기록이라 이 자체는 문제가 아니나(CLAUDE.md 규약에 부합), prompt 파일(_prompts/*.md)이 매우 크고 spec/conventions 전체 내용을 인라인 포함하여 git log 상 해당 commit의 diff 가독성을 크게 떨어뜨린다.
  - 제안: orchestrator가 생성하는 prompt 파일의 spec 인라인 포함 범위를 최소화하는 방향을 장기적으로 검토. 현재 자동 생성 구조이므로 즉각 수정 대상은 아님.

---

## 요약

이번 변경은 Makefile, CHANGELOG, README, plan 문서, consistency-check 아티팩트로 구성된 순수 문서·인프라 수정이다. 코드 로직 변경은 없으며 전반적으로 docs-consolidation 이후 잔존 참조를 정리하고, e2e `--build` 관련 안내를 여러 문서에 일관되게 반영한 작업이다. 유지보수성 관점의 주요 개선 여지는 CHANGELOG와 README의 한 단락에 여러 정보(동작 설명·결정 근거·최적화 이유)가 혼합된 점, Makefile 주석 블록의 시각적 귀속 모호성, plan 미체크 항목이 commit에 포함된 점이다. 이들은 모두 INFO/WARNING 수준으로 기능 정확성에는 영향이 없으며, 정보 밀도와 가독성 면에서 소폭 개선하면 미래 기여자의 파악 부담을 줄일 수 있다. 기존 코드베이스 스타일·패턴은 대체로 잘 준수되어 있고, CLAUDE.md의 네이밍·폴더 컨벤션도 올바르게 반영되었다.

## 위험도

LOW
