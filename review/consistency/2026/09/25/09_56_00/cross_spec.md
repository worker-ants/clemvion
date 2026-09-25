# Cross-Spec 일관성 검토 — `plan/in-progress/harness-probe-isolation.md`

## 검토 범위 메모

target 은 `.claude/tests/` 하네스(pytest 프로브 격리)를 다루는 **harness-only** 작업 plan 이며
frontmatter 에 `spec_impact: none` 을 명시하고, 본문 체크리스트 자체도 "spec 영역이 없는
harness-only 변경이라 `--impl-prep` 이 성립하지 않는다" 고 밝히며 `--plan` 모드로 스스로를
목표물로 지정했다. 즉 target 은 product spec 의 엔티티·API·요구사항 ID·상태 머신·RBAC 를
새로 정의하거나 변경하지 않는다 — `.claude/tests/*.py` · `_harness.py` 등 harness 코드/테스트만
바꾼다(CLAUDE.md 상 `developer` 소유 영역: `.claude/hooks/**`·`.claude/tools/**`·`.claude/tests/**`).

번들된 "관련 spec 본문"은 `spec/5-system/7-llm-client.md` 와 `spec/0-overview.md` 만 예산 안에
들어왔고 나머지는 전부 "컨텍스트 예산 초과" 로 절단됐다(`spec/conventions/**` 포함, 단 한 건도
번들에 없음). 다만 target 이 spec 내용을 정의/변경하지 않으므로 이 절단이 결론에 영향을 주는
빈틈은 아니다 — 아래 근거로 확인했다.

## 발견사항

- **[INFO]** `7-llm-client.md` 는 target 안에서 스펙 대상이 아니라 "우연히 피해를 보는 파일"로만 등장
  - target 위치: §A 표 1행("`spec/5-system/7-llm-client.md` 에 미커밋 편집 → `cp` 원복"), §A 하단
    "`7-llm-client.md` 는 실제 spec 이다. 그 사이 누가 커밋했으면 무관한 spec 편집이 PR 에 들어간다"
  - 충돌 대상: `spec/5-system/7-llm-client.md` 본문 (LLM 클라이언트 추상화 계층 spec)
  - 상세: target 은 이 파일의 **내용**(엔티티·인터페이스·에러 코드 등)을 전혀 다루지 않는다.
    `test_consistency_bundle_priority.py` 의 프로브가 이 파일 끝에 "프로브 3줄"을 임시로 덧붙였다가
    `cp` 로 원복하는 동안 병렬 실행에서 서로의 프로브가 섞이는 **테스트 하네스 버그**를 기술할 뿐이다.
    `7-llm-client.md` 를 특정 spec 파일로 고른 것은 (아마) 이 spec 영역이 실존하고 충분히 크기 때문일
    뿐, 그 파일의 §2~§8/Rationale 어떤 서술과도 모순이 없다. 즉 이 항목은 "데이터 모델/API/요구사항
    ID/상태 전이/RBAC/계층 책임" 어느 관점으로도 충돌이 아니다 — 오히려 target 의 해결책(§C "임시
    디렉터리의 저장소 사본 + 루트 주입")이 채택되면 이 spec 파일이 프로브에 오염될 표면 자체가
    사라진다.
  - 제안: 조치 불필요. 다만 구현 단계에서 `make_probe_repo` 가 복사하는 서브트리 예시로 계속
    `spec/5-system` 을 쓸 경우, 테스트 코드 주석에 "이 파일은 예시일 뿐 내용을 검증하지 않는다"는
    점을 남겨두면 이후 리뷰어가 spec 내용 변경으로 오인하지 않는다(선택 사항, 비차단).

- **[INFO]** 번들 예산 절단으로 `spec/conventions/**` 가 전혀 포함되지 않음
  - target 위치: 프롬프트 상단 메타 정보(관련 spec 본문 조립 결과)
  - 충돌 대상: 없음(비교 대상 부재)
  - 상세: `spec/conventions/spec-impl-evidence.md`, `migrations.md` 등 모든 convention 문서가
    "컨텍스트 예산 초과"로 빠졌다. 기존에 알려진 `--spec` 모드 예산 이슈와 동일한 패턴이다. 그러나
    target 이 spec/convention 문서 자체를 제안·변경하지 않으므로(harness 코드만 변경) 이 절단이
    실제 cross-spec 판정을 바꾸지 않는다 — 판정에는 영향 없음, 기록만 남긴다.
  - 제안: 조치 불필요(이 target 한정). harness 예산 이슈 자체는 이미 알려진 별도 트래킹 대상.

target 본문에서 다루는 "요구사항 ID"(예: `ND-IF~ND-BG`, `NAV-*` 류)나 RBAC 롤(`editor`/`admin`),
API endpoint, 엔티티 상태 머신은 전혀 새로 도입/변경되지 않는다 — 6개 점검 관점(데이터 모델·API
계약·요구사항 ID·상태 전이·RBAC·계층 책임) 중 어느 것도 target 문서 안에서 다뤄지지 않아 충돌
표면이 존재하지 않는다.

## 요약

target 은 pytest 하네스가 실제 저장소 트리(특히 `spec/5-system/7-llm-client.md`, 임시 plan/세션
파일)에 프로브를 남겨 병렬 실행 시 잔여물이 남는 문제를 격리(임시 git 저장소 사본 + 루트 주입)로
해결하려는 **harness-only** 작업 plan 이다(`spec_impact: none`, developer 소유 `.claude/tests/**`
범위). product spec 의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 것도 새로
정의하거나 바꾸지 않으며, 유일하게 등장하는 실제 spec 파일(`7-llm-client.md`)도 그 **내용**과는
무관하게 "프로브가 우연히 건드리는 피해자" 로만 언급된다. 번들 예산이 `spec/conventions/**` 를
전부 절단했지만 target 이 그 문서들과도 상호작용하지 않으므로 이 검토의 결론에 영향을 주지 않는다.
Cross-Spec 관점에서 충돌 후보 자체가 성립하지 않는 케이스다.

## 위험도

NONE
