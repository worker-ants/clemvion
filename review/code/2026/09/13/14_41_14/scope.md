# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 공유 트래커 파일에 이번 작업과 무관한 새 백로그 항목을 추가
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3406-3414` (새로 추가된 `cafe24-api-metadata.md §4` Principle 7→0 오인용 항목)
  - 상세: 이 diff 는 `guide-identifier-existence` 가드 작업과 별개로, `--impl-prep` consistency-check 중 우연히 발견한 `spec/conventions/cafe24-api-metadata.md` 의 Principle 번호 오인용을 같은 트래커 파일에 새 항목으로 등재한다. 내용상 이번 PR 의 목적(식별자 실재성 가드 확장)과는 완전히 무관한 별개 결함이다. 다만 이 저장소의 확립된 관례(`developer` 는 `spec/` 쓰기 권한이 없어 직접 고칠 수 없는 발견은 그 턴에 `plan/` 백로그로 등재해야 함, plan §D 지적사항 처리 표에도 명시)를 정확히 따른 것이고, plan 체크리스트 항목("planner 등재 신규 — cafe24-api-metadata.md §4 Principle 7→0 … (선재, 무관)")에서도 스스로 "무관"임을 명시해 은폐 없이 투명하게 처리했다.
  - 제안: 조치 불요 — 프로젝트 관례상 정당한 처리이므로 CRITICAL/WARNING 대상은 아니다. 기록으로만 남긴다.

- **[INFO]** 가드 파일 교체가 `git mv` 대신 delete+create 로 이뤄져 이력이 끊긴다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`(삭제) / `guide-error-code-existence.test.ts`(삭제) → `guide-identifier-scan.ts`(신규) / `guide-identifier-existence.test.ts`(신규)
  - 상세: diff 가 `deleted file mode` + `new file mode` 쌍으로 나타나 git 이 rename 으로 인식하지 못한다(자매 파일 `guide-sanitized-message-parity.test.ts` 는 리네임 대상이 아니라고 plan 이 명시했으니 대조는 안 됨). 내용이 축 구조·기준집합·허용목록까지 상당히 재설계됐으니 순수 리네임은 아니지만, `git blame`/이력 추적이 끊기는 점은 향후 "이 가드가 언제·왜 이렇게 됐나"를 추적할 때 비용이 된다.
  - 제안: 조치 불요(이미 병합 완료된 diff 형태라 되돌리는 비용이 더 큼) — 다음에 유사한 대규모 가드 재설계 시 `git mv` 후 편집하는 방식을 고려할 것.

## 요약

핵심 변경(`guide-error-code-*` → `guide-identifier-*` 리네임, 환경변수 축 추가, 방어적 허용목록 4강제 도입, `PROJECT.md`·`spec-draft-nullable-notation-followups.md`의 관련 참조 갱신, `plan/in-progress/guide-identifier-existence.md` 신설, `review/consistency/**` 산출물 커밋)은 모두 트래커 항목 하나("가이드가 적는 식별자가 실재하는지 세는 가드가 없다")를 닫는 단일 목적에 수렴한다. 리네임·축 교체·허용목록 신설은 임의 확장이 아니라 `--impl-prep` naming_collision INFO 및 plan §A/§B 의 실측(과거 결함 `MCP_INSECURE_URL_ALLOWED`을 구 가드 3축이 전부 놓친다는 것)에 근거해 정당화되어 있고, 근거·대가·기각한 대안까지 plan·코드 주석에 기록돼 있어 "요청 이상의 변경"으로 보기 어렵다. `spec-draft-nullable-notation-followups.md` 편집도 리네임에 따른 전방 참조 갱신 + 원 항목 종결(취소선+번복 근거)에 국한되며, 무관한 다른 백로그 항목은 건드리지 않았다. 유일하게 스코프 경계선에 걸리는 것은 그 파일에 새로 등재된 `cafe24-api-metadata.md` Principle 오인용 항목인데, 이는 프로젝트가 명문화한 "발견 즉시 등재" 관례를 따른 것이고 PR 스스로 "무관"이라 명시했으므로 은폐성 스코프 크리프는 아니다. 포맷팅·주석·임포트·설정 파일 관점에서는 불필요한 변경이 관찰되지 않았다.

## 위험도

LOW
