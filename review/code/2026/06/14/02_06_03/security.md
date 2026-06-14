# 보안(Security) 리뷰

## 발견사항

### **[INFO]** `resolveTimezone` — 타임존 값 무검증 통과 (schedules.service.ts)
- 위치: `/codebase/backend/src/modules/schedules/schedules.service.ts` — `resolveTimezone` 메서드 (라인 473-483)
- 상세: `explicit` 파라미터(사용자 DTO에서 전달된 `dto.timezone`)가 truthy면 즉시 반환되며, IANA 유효성 검증을 전혀 거치지 않는다. `UpdateWorkspaceSettingsDto`에 선언된 `@MaxLength(64)` + `@IsString()`만으로는 `"../../../etc"`, `"'; DROP TABLE--"` 같은 값이 차단되지 않는다. `computeNextRuns`에서 `CronExpressionParser.parse`의 `tz` 옵션에 이 값이 넘어가며, cron-parser 라이브러리가 잘못된 timezone으로 동작할 경우 예외가 잡혀 `BadRequestException`만 발생하므로 직접적 인젝션 경로는 없지만, 워크스페이스 `settings.timezone`에 임의 문자열이 영속화된다는 점에서 입력 검증 누락이다.
- 제안: `workspaces.service.ts`에 이미 `isValidIanaTimezone()` 유틸이 공개(`export`)되어 있다. `resolveTimezone` 내 `explicit` 분기에서 동일 함수로 IANA 유효성을 검증한 뒤 무효 시 `BadRequestException` 을 던지거나, 최소한 `'Asia/Seoul'`로 폴백하도록 보완해야 한다.

```typescript
// schedules.service.ts resolveTimezone 제안
import { isValidIanaTimezone } from '../workspaces/workspaces.service';

private async resolveTimezone(workspaceId: string, explicit: string | undefined): Promise<string> {
  if (explicit) {
    if (!isValidIanaTimezone(explicit)) {
      throw new BadRequestException({ code: 'INVALID_TIMEZONE', message: `유효하지 않은 타임존: ${explicit}` });
    }
    return explicit;
  }
  // ... 기존 workspace fallback 로직
}
```

---

### **[INFO]** `workspace.settings` JSONB 필드 비구조화 역직렬화 신뢰 — 타임존 값 반환 경로 (workspaces.service.ts)
- 위치: `/codebase/backend/src/modules/schedules/schedules.service.ts` `resolveTimezone` 및 `/codebase/backend/src/modules/workspaces/workspaces.service.ts` `getWorkspaceSettings`
- 상세: `workspace.settings?.timezone`이 DB에서 읽히는 값이므로 이전에 어떤 방식으로든 임의 문자열이 저장되어 있었다면 (마이그레이션 이전 레코드, 직접 DB 수정 등) 해당 값이 검증 없이 `resolveTimezone` 반환값으로 사용되어 cron-parser에 넘어간다. `getWorkspaceSettings` 반환 응답에도 그대로 포함된다.
- 제안: `resolveTimezone`의 DB 조회 결과(`wsTz`)에 대해서도 `isValidIanaTimezone(wsTz)` 검사를 추가해 무효 저장값은 폴백 처리하도록 방어한다.

---

### **[INFO]** 에러 메시지에 사용자 입력 반영 (workspaces.service.ts)
- 위치: `/codebase/backend/src/modules/workspaces/workspaces.service.ts` — `updateWorkspaceSettings` 라인 2219-2222
- 상세: `throw new BadRequestException({ code: 'INVALID_TIMEZONE', message: \`유효하지 않은 타임존입니다: ${tz}\` })` — 사용자가 제출한 timezone 값이 에러 메시지에 그대로 포함되어 HTTP 400 응답 body에 반영된다. `tz`는 최대 64자 문자열이며 HTML/JSON 컨텍스트상 실질적 XSS 위험은 낮지만, 클라이언트가 이 메시지를 직접 DOM에 렌더링한다면 문제가 될 수 있다.
- 제안: 에러 메시지에서 사용자 입력을 제거하거나 (`"유효하지 않은 타임존 식별자입니다"`) API 클라이언트가 code 필드만 소비하도록 규약을 명시한다. 현재 코드 수준에서 즉각적인 보안 취약점은 아니며 방어적 개선 권고 수준이다.

---

### **[INFO]** `search` 파라미터 ILIKE 패턴 — 퍼센트 와일드카드 미처리 (schedules.service.ts)
- 위치: `/codebase/backend/src/modules/schedules/schedules.service.ts` — `findAll` 라인 503-505
- 상세: `qb.andWhere('t.name ILIKE :search', { search: \`%${search}%\` })` — TypeORM 파라미터 바인딩으로 SQL 인젝션은 차단되어 있으나, 사용자가 `%` 또는 `_` 를 포함한 검색어를 입력하면 LIKE 와일드카드가 추가 확장되어 예상보다 넓은 결과가 반환될 수 있다. 이번 변경에서 새로 도입된 코드가 아니므로 이번 PR 범위에 직접 속하지 않으나, 리뷰 대상 파일에 포함되어 있어 기록한다.
- 제안: 검색어에서 `%`, `_`, `\` 문자를 이스케이프 처리하거나 (`search.replace(/%/g, '\\%').replace(/_/g, '\\_')`) 이 동작이 의도된 것이라면 명시적 주석을 추가한다.

---

## 요약

이번 변경은 스케줄 타임존 워크스페이스 기반 fallback을 구현한다. 핵심 보안 패턴(SQL 인젝션 차단용 whitelist orderBy, 인가 역할 검증, 트랜잭션 기반 비관적 락, 하드코딩된 시크릿 부재)은 모두 양호하다. 주요 관찰 사항은 `schedules.service.ts`의 `resolveTimezone`이 `explicit`(사용자 DTO) 타임존을 IANA 검증 없이 통과시킨다는 점이다. 동일 코드베이스에 이미 `isValidIanaTimezone()` 유틸이 존재함에도 이 경로에서 활용되지 않아 임의 문자열이 영속화 및 cron-parser로 넘어갈 수 있다. 실질적 익스플로잇 경로는 제한적이나(cron-parser 예외가 포착되어 BadRequestException으로 변환됨) 방어적 입력 검증 일관성 측면에서 보완이 권고된다. 에러 메시지에 사용자 입력이 반영되는 부분도 낮은 등급의 개선 사항이다.

## 위험도

LOW
