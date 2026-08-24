### 발견사항

- **[INFO]** provider 3개 문서(B7)에 동일 문구의 각주가 축약 없이 전문 반복(triplication)
  - 위치: `spec/4-nodes/7-trigger/providers/discord.md:258-264`, `spec/4-nodes/7-trigger/providers/slack.md:235-241`, `spec/4-nodes/7-trigger/providers/telegram.md:162-168` (세 파일 모두 게이트 번호로 확인 — 세 블록이 문자 그대로 동일)
  - 상세: B6 이 "같은 계약을 여러 문서가 산문으로 재진술하면 결함"이라는 원칙 아래 4곳의 사본을 정본 링크로 축약했는데, B7 이 그 직후 세 provider 문서에 완전히 동일한 4문장짜리 프레임 각주를 그대로 3벌 복제했다(마지막 줄만 정본 링크). 다만 이 저장소는 provider 문서(cafe24/makeshop 등) 자체가 "각 provider 가 독립 진화하는 의도적 미러"라는 기존 선례(`project_cafe24_makeshop_mirror_dedup_withdrawn`)가 있고, 이 표 자체도 이미 3파일에 걸쳐 동일 구조로 중복돼 있던 자리라 — 새로운 반경(scope)의 사본이라기보다 기존 provider-미러 패턴을 그대로 따른 것으로 보인다. 기능적 위험은 없다.
  - 제안: 조치 불요(정보 기록). 다음에 이 세 파일을 다시 열 때, 이 각주도 B6 과 같은 링크-only 축약 대상인지 재고할 만하다는 점만 남긴다.

review 대상 38개 파일 전체를 대조한 결과, 실제 spec 편집(파일 30~38, 9개)은 plan frontmatter `spec_impact` 9건과 정확히 1:1 대응하며 `codebase/**` 변경은 0줄이다(`git diff origin/main --stat` 실측). 각 spec diff 는 B1(node-output.md Principle 0 wire-only 8키 각주) · B2(egress-masking.md §2 4단계 파이프라인) · B3(WS §4.4 nodeType carve-out 각주, 2회 재작성 포함) · B5(WS §3.2 background:run 채널 행) · B6(EIA §R17·conversation-thread §9.7·chat-channel-adapter.md 3곳을 정본 링크로) · B7(provider 3문서 표 프레임 각주) 항목에 정확히 대응하는 순수 추가(additive) 블록쿼트/각주이며, 무관한 리팩토링·포맷팅 변경·기존 문장 삭제/재작성은 없다(B3 만 예외적으로 기존 한 줄을 확장). B4(`conversation-thread.md` frontmatter `code:` 추가)는 근거 부재로 **집행하지 않고 won't-do 로 트래커만 닫아** 실제 스코프를 오히려 줄였다. `plan/**`·`review/consistency/**` 변경은 이 배치가 의무적으로 거쳐야 하는 3회차 `/consistency-check --spec` 게이트(쓰기 전/쓴 뒤/WARNING 수정 후)의 표준 산출물이며, 트래커(`spec-sync-external-interaction-api-gaps.md`)에 새로 등재된 3건(execution-engine `code:` 미판정, harness 번들러 후보 미도달, `### 4.4` 헤딩 중복)은 모두 체크 안 된 백로그 등재일 뿐 이번 PR 에서 실행되지 않았다. 파일명 리네임(`planner-doc-batch.md` → `spec-draft-planner-doc-batch.md`)도 `git mv` 로 깨끗이 이뤄졌고 참조 잔재가 없다.

### 요약
변경 범위가 매우 정밀하게 통제돼 있다 — 실제 spec 편집이 plan 이 선언한 9개 `spec_impact` 파일에 정확히 국한되고, `codebase/**` 변경이 전혀 없으며(순수 문서 PR), 무관한 리팩토링·포맷팅·주석/임포트/설정 변경도 발견되지 않았다. B4 는 근거 부족을 이유로 스스로 실행을 취소(won't-do)해 오히려 스코프를 줄였고, 트래커에 등재한 후속 항목들은 실행이 아니라 백로그 등재에 그친다. 유일한 관찰은 provider 3문서에 동일 각주가 축약 없이 반복된 점인데, 이는 이 저장소의 기존 provider-미러 컨벤션과 일치해 스코프 위반으로 보기 어렵다.

### 위험도
NONE
