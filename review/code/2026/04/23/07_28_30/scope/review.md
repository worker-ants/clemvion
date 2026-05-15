### 발견사항

---

**[WARNING] 두 개의 독립 기능이 하나의 변경셋에 혼재**
- 위치: 변경셋 전체
- 상세: 이번 변경셋은 명확히 다른 두 가지 기능을 포함한다.
  1. **Plan-only 턴 핑퐁 루프 차단** (이전 리뷰 후속): `stream.service.ts` `isPlanPendingApproval` 헬퍼 추출 + 루프 가드, `stream.service.spec.ts` gemini 테스트, `memory/provider-quirks.md` 문서화, `RESOLUTION.md`
  2. **DANGLING_OUTPUT_PORTS 신규 기능**: `resolve-dynamic-ports.ts/spec.ts` 신규 파일, `review-workflow.ts/spec.ts` 신규 검사, `system-prompt.ts/spec.ts` 프롬프트 교육 내용 추가, `stream.service.ts` `nodeDefs` 주입, `stream.service.spec.ts` 통합 테스트

  두 기능은 같은 모듈(workflow-assistant) 내에 있고 주제적으로 연관되지만(LLM 동작 교정), 변경 이유·영향 범위·리뷰 포인트가 완전히 다르다. 단일 커밋으로 합치면 리뷰 복잡도가 증가하고 bisect·롤백 단위가 모호해진다.
- 제안: 가능하면 두 기능을 별도 커밋/PR로 분리. 배포 타임라인 등의 이유로 불가하다면 PR 본문에 두 기능의 경계를 명시.

---

**[INFO] `system-prompt.ts` Example 2 전면 교체 — 교육 사례 자체가 바뀜**
- 위치: `system-prompt.ts` `### Ex2.` 섹션
- 상세: 기존 Ex2(승인/거절 2-버튼 → 이메일 발송)가 한식/양식/중식/기타 4-버튼 설문으로 완전히 교체되었다. DANGLING_OUTPUT_PORTS 교육을 위한 의도된 변경이지만, 기존 사용자/팀이 2-버튼 예제를 레퍼런스로 참고하고 있었다면 breaking change가 된다. 최소 침습 접근이었다면 Ex2를 유지하고 Ex3로 추가하는 방법도 있었다.
- 제안: 현행 교체 방향은 교육 효과상 합리적이므로 수용 가능. 다만 PR 메시지에 "기존 Ex2 교체" 명시를 권장.

---

**[INFO] `resolve-dynamic-ports.ts`가 프론트엔드 로직의 백엔드 복사본임이 명시되어 있으나, 드리프트 방지 장치가 테스트뿐**
- 위치: `resolve-dynamic-ports.ts` JSDoc 주석
- 상세: "Backend mirror of `frontend/.../resolve-dynamic-ports.ts`"임을 명시하고 `resolve-dynamic-ports.spec.ts`로 프론트엔드 픽스처를 미러링하는 방식으로 동기화를 검증한다. 그러나 프론트엔드 원본이 변경될 때 백엔드 spec이 자동으로 실패하지 않는 구조다 — 두 파일 모두 독립적으로 통과할 수 있다. 이는 이번 변경의 scope 이탈이 아니라 향후 유지보수 위험이다.
- 제안: 이번 변경 범위 내에서는 문서화로 충분. 장기적으로는 CI에서 두 파일의 `DynamicPortsSpec kind` 열거를 비교하는 단순 스크립트 추가 고려.

---

**[INFO] `review/2026-04-23_01-25-47/` 디렉토리 전체가 변경셋에 포함**
- 위치: `review/2026-04-23_01-25-47/SUMMARY.md`, `RESOLUTION.md`, 각 에이전트 리뷰 파일
- 상세: 이전 리뷰의 산출물(SUMMARY, 에이전트별 review.md)과 이번 변경셋의 해소 내역(RESOLUTION.md)이 함께 커밋된다. 프로젝트 컨벤션(`review/**/RESOLUTION.md` 생성)에 부합하는 의도된 패턴이다. 기능 코드와 함께 커밋되는 것은 정상.
- 제안: 현행 유지.

---

### 요약

변경셋 전체는 workflow-assistant 모듈 내부에 응집되어 있으며, 관련 없는 파일이나 무의미한 포맷팅 변경은 없다. 다만 plan-only 턴 핑퐁 루프 차단(이전 리뷰 후속 조치)과 DANGLING_OUTPUT_PORTS(신규 기능)라는 두 개의 독립적 기능이 하나의 변경셋에 혼재하는 것이 주요 scope 관점의 지적사항이다. 각 기능 내부는 완결성 있게 구현(코드 + 테스트 + 문서 + 메모리)되어 있어 반쪽짜리 구현이나 over-engineering은 없다.

### 위험도
**LOW**