import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageActionEditDialogComponent } from './page-action-edit-dialog.component';

describe('PageActionEditDialogComponent', () => {
  let component: PageActionEditDialogComponent;
  let fixture: ComponentFixture<PageActionEditDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageActionEditDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PageActionEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
