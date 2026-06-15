# 변경 범위(Scope) 리뷰 결과

## 발견사항

범위 이탈 항목이 없다. 모든 변경이 "form file validation 구현 완료 후 spec 동기화" 의도에 정확히 부합한다.

### 파일별 확인

**파일 1 — `review/consistency/2026/06/15/11_33_17/rationale_continuity.md`**
- [INFO] --impl-prep 단계의 consistency-check 산출물. review/ 산출 경로 규약(`review/consistency/<ISO>/<hh_mm_ss>/`)에 따른 신규 파일이며 의도된 생성이다. 범위 이탈 없음.

**파일 2~9 — `review/consistency/2026/06/15/12_30_46/` 하위 파일 전체**
- [INFO] --impl-done 단계의 consistency-check 산출물 6종(SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md). 동일 경로 규약에 따른 신규 파일이며 의도된 생성이다. 범위 이탈 없음.

**파일 10 — `spec/4-nodes/6-presentation/4-form.md`**
- [INFO] 변경 의도(file validation 구현 완료 반영)에 직접 대응하는 spec 갱신이다. 변경 내용은 다음 네 가지로 모두 impl-done 동기화 범위에 속한다:
  1. frontmatter `code:` 에 `form-mode.ts`, `types.ts` 2줄 추가 (consistency-check INFO-1 해소).
  2. §1 table 의 "계획상 기본" 문구를 "미설정 시 기본"으로 교체 및 callout 블록 재작성 (Planned 표기 제거, 구현 완료 반영).
  3. §1.5 "실시간 검증 — 미구현 (Planned)" 섹션을 실제 구현 동작으로 전환 및 `validation.message` v1 미적용 callout 추가.
  4. §6.2 표 및 검증 지점 callout, §Rationale 3항 갱신 (validateFileField 통합, coerceFormSubmission 제거, chat-channel 예외 명시).
- 범위 이탈 없음.

**파일 11 — `spec/5-system/14-external-interaction-api.md`**
- [INFO] §5.1 `400 VALIDATION_ERROR` 에러 행 1줄 수정. `**Planned**` 표기 제거 및 `type:'file'` 항목 열거 추가. consistency-check WARNING-1 해소에 정확히 대응하는 최소 변경이다. 해당 행 이외의 수정 없음. 범위 이탈 없음.

**파일 12 — `spec/5-system/6-websocket-protocol.md`**
- [INFO] §4.2 `VALIDATION_ERROR` 행 1줄 수정. `type:'file'` MIME·크기·개수 항목 추가. consistency-check WARNING-2 해소에 정확히 대응하는 최소 변경이다. 해당 행 이외의 수정 없음. 범위 이탈 없음.

---

## 요약

이번 PR 의 모든 변경은 "form file validation 구현 완료 후 spec 동기화(A-1 후속, spec-sync-form-validation-enum 브랜치)" 의도에 정확히 국한된다. review/ 산출물 8개는 --impl-prep / --impl-done consistency-check 의 규약 산출물이고, spec 3파일의 수정은 각각 cross-check WARNING 해소와 구현 완료 반영에 1:1 대응한다. 불필요한 리팩토링, 관련 없는 파일 수정, 의미 없는 포맷팅·공백 변경, 요청 외 기능 추가, 의도하지 않은 설정 변경은 일체 발견되지 않았다.

## 위험도

NONE
